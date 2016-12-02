/* eslint-env node */

import WebSocket, { Server as WebSocketServer } from 'uws';

import {
  GRAPHQL_SUBSCRIPTIONS,
  SUBSCRIPTION_FAIL,
  SUBSCRIPTION_DATA,
  SUBSCRIPTION_START,
  SUBSCRIPTION_END,
  SUBSCRIPTION_SUCCESS,
  SUBSCRIPTION_KEEPALIVE,
} from './constants';

export default class Server {
  constructor(options, httpServer) {
    const { subscriptionManager, onSubscribe, keepAlive } = options;

    if (!subscriptionManager) {
      throw new Error('Must provide `subscriptionManager` to websocket server constructor.');
    }

    this.subscriptionManager = subscriptionManager;
    this.onSubscribe = onSubscribe;

    // init and connect websocket server to http
    this.wsServer = new WebSocketServer({
      server: httpServer,
      // TODO: Origin verification.
      verifyClient: ({ req }) => (
        (req.headers['sec-websocket-protocol'] || '').split(', ').indexOf(GRAPHQL_SUBSCRIPTIONS) !== -1
      ),
    });

    this.wsServer.on('connection', (ws) => {
      // Send regular keep alive messages if keepAlive is set
      if (keepAlive) {
        const keepAliveTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            this.sendKeepAlive(ws);
          } else {
            clearInterval(keepAliveTimer);
          }
        }, keepAlive);
      }

      // Keep track of the subscriptions within this connection:
      const connectionSubscriptions = {};

      ws.on('message', (data) => { this.onMessage(ws, data, connectionSubscriptions); });
      ws.on('close', () => { this.onClose(ws, connectionSubscriptions); });
    });

    return this.wsServer;
  }

  // TODO test that this actually works
  onClose(ws, connectionSubscriptions) {
    Object.keys(connectionSubscriptions).forEach((subId) => {
      this.subscriptionManager.unsubscribe(connectionSubscriptions[subId]);
      delete connectionSubscriptions[subId];
    });
  }

  onMessage(ws, data, connectionSubscriptions) {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(data);
    } catch (e) {
      this.sendSubscriptionFail(ws, null, { errors: [{ message: e.message }] });
      return;
    }

    const subId = parsedMessage.id;
    switch (parsedMessage.type) {

      case SUBSCRIPTION_START: {
        const baseParams = {
          query: parsedMessage.query,
          variables: parsedMessage.variables,
          operationName: parsedMessage.operationName,
          context: {},
          formatResponse: undefined,
          formatError: undefined,
          callback: undefined,
        };
        let promisedParams = Promise.resolve(baseParams);

        if (this.onSubscribe) {
          promisedParams = Promise.resolve(this.onSubscribe(parsedMessage, baseParams, ws));
        }

        // if we already have a subscription with this id, unsubscribe from it first
        // TODO: test that this actually works
        if (connectionSubscriptions[subId]) {
          this.subscriptionManager.unsubscribe(connectionSubscriptions[subId]);
          delete connectionSubscriptions[subId];
        }

        promisedParams.then((params) => {
          // create a callback
          // error could be a runtime exception or an object with errors
          // result is a GraphQL ExecutionResult, which has an optional errors property
          params.callback = (error, result) => {
            if (!error) {
              this.sendSubscriptionData(ws, subId, result);
            } else if (error.errors) {
              this.sendSubscriptionData(ws, subId, { errors: error.errors });
            } else {
              this.sendSubscriptionData(ws, subId, { errors: [{ message: error.message }] });
            }
          };
          return this.subscriptionManager.subscribe(params);
        }).then((graphqlSubId) => {
          connectionSubscriptions[subId] = graphqlSubId;
          this.sendSubscriptionSuccess(ws, subId);
        }).catch((e) => {
          if (e.errors) {
            this.sendSubscriptionFail(ws, subId, { errors: e.errors });
          } else {
            this.sendSubscriptionFail(ws, subId, { errors: [{ message: e.message }] });
          }
        });
        break;
      }

      case SUBSCRIPTION_END:
        // find subscription id. Call unsubscribe.
        // TODO untested. catch errors, etc.
        if (typeof connectionSubscriptions[subId] !== 'undefined') {
          this.subscriptionManager.unsubscribe(connectionSubscriptions[subId]);
          delete connectionSubscriptions[subId];
        }
        break;

      default:
        this.sendSubscriptionFail(ws, subId, {
          errors: [{
            message: 'Invalid message type. Message type must be `subscription_start` or `subscription_end`.',
          }],
        });
    }
  }

  sendSubscriptionData(ws, subId, payload) {
    const message = {
      type: SUBSCRIPTION_DATA,
      id: subId,
      payload,
    };

    ws.send(JSON.stringify(message));
  }

  sendSubscriptionFail(ws, subId, payload) {
    const message = {
      type: SUBSCRIPTION_FAIL,
      id: subId,
      payload,
    };

    ws.send(JSON.stringify(message));
  }

  sendSubscriptionSuccess(ws, subId) {
    const message = {
      type: SUBSCRIPTION_SUCCESS,
      id: subId,
    };

    ws.send(JSON.stringify(message));
  }

  sendKeepAlive(ws) {
    const message = {
      type: SUBSCRIPTION_KEEPALIVE,
    };

    ws.send(JSON.stringify(message));
  }
}
