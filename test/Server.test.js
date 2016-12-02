// /* global WebSocket */
//
// import { expect, assert } from 'chai';
// import sinon from 'sinon';
// import { createServer } from 'http';
// import { PubSub, SubscriptionManager } from 'graphql-subscriptions';
// import { buildSchema } from 'graphql';
// import Client from '../src/Client';
// import Server from '../src/Server';
// import {
//   GRAPHQL_SUBSCRIPTIONS,
//   SUBSCRIPTION_KEEPALIVE,
//   SUBSCRIPTION_FAIL,
// } from '../src/constants';
//
// const TEST_PORT = 8090;
// const KEEP_ALIVE_TEST_PORT = 8091;
//
// const httpServerRaw = createServer();
// const httpServerKeepAlive = createServer();
// httpServerRaw.listen(TEST_PORT);
// httpServerKeepAlive.listen(KEEP_ALIVE_TEST_PORT);
//
// const schema = buildSchema(`
//   type User {
//     id: ID
//   }
//
//   type Query {
//     user: User
//   }
//
//   type Subscription {
//     updateUser: User
//   }
//
//   schema {
//     query: Query
//     subscription: Subscription
//   }
// `);
//
// describe('Server', () => {
//   let wsServer;
//   let onSubscribeSpy;
//   let subscriptionManager;
//
//   beforeEach(() => {
//     const pubsub = new PubSub();
//
//     subscriptionManager = new SubscriptionManager({
//       schema,
//       pubsub,
//       setupFunctions: {},
//     });
//
//     onSubscribeSpy = sinon.stub().returns({});
//
//     wsServer = new Server({
//       subscriptionManager,
//       onSubscribe: onSubscribeSpy,
//     }, httpServerRaw);
//
//     // Also start a keepAlive server:
//     // eslint-disable-next-line no-new
//     new Server({
//       subscriptionManager,
//       keepAlive: true,
//     }, httpServerKeepAlive);
//   });
//
//   afterEach(() => {
//     if (wsServer) wsServer.close();
//   });
//
//   it('should send correct results to multiple clients with subscriptions', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//     const client1 = new Client(`ws://localhost:${TEST_PORT}/`);
//
//     let numResults = 0;
//     setTimeout(() => {
//       client.subscribe({
//         query:
//         `subscription useInfo($id: String) {
//           user(id: $id) {
//             id
//             name
//           }
//         }`,
//         operationName: 'useInfo',
//         variables: {
//           id: 3,
//         },
//
//       }, (error, result) => {
//         if (error) {
//           done(new Error('unexpected error'));
//         }
//         if (result) {
//           assert.property(result, 'user');
//           assert.equal(result.user.id, '3');
//           assert.equal(result.user.name, 'Jessie');
//           numResults += 1;
//         } else {
//           // pass
//         }
//         // if both error and result are null, this was a SUBSCRIPTION_SUCCESS message.
//       });
//     }, 100);
//
//     const client11 = new Client(`ws://localhost:${TEST_PORT}/`);
//     let numResults1 = 0;
//     setTimeout(() => {
//       client11.subscribe({
//         query:
//         `subscription useInfo($id: String) {
//           user(id: $id) {
//             id
//             name
//           }
//         }`,
//         operationName: 'useInfo',
//         variables: {
//           id: 2,
//         },
//
//       }, (error, result) => {
//         if (error) {
//           done(new Error('todo: add real error message'));
//         }
//         if (result) {
//           assert.property(result, 'user');
//           assert.equal(result.user.id, '2');
//           assert.equal(result.user.name, 'Marie');
//           numResults1 += 1;
//         }
//       // if both error and result are null, this was a SUBSCRIPTION_SUCCESS message.
//       });
//     }, 100);
//
//     setTimeout(() => {
//       client.unsubscribeAll();
//       expect(numResults).to.equals(1);
//       client1.unsubscribeAll();
//       expect(numResults1).to.equals(1);
//       done();
//     }, 300);
//   });
//
//   it('should send a subscription_fail message to client with invalid query', (done) => {
//     const client1 = new Client(`ws://localhost:${TEST_PORT}/`);
//     setTimeout(() => {
//       client1.client.onmessage = (message) => {
//         const messageData = JSON.parse(message.data);
//         assert.equal(messageData.type, SUBSCRIPTION_FAIL);
//         assert.isAbove(messageData.payload.errors.length, 0, 'Number of errors is greater than 0.');
//         done();
//       };
//       client1.subscribe({
//         query:
//         `subscription useInfo($id: String) {
//           user(id: $id) {
//             id
//             birthday
//           }
//         }`,
//         operationName: 'useInfo',
//         variables: {
//           id: 3,
//         },
//       }, () => {});
//     }, 100);
//   });
//
//   it('correctly sets the context in onSubscribe', (done) => {
//     const CTX = 'testContext';
//     const client3 = new Client(`ws://localhost:${TEST_PORT}/`);
//     client3.subscribe({
//       query:
//       `subscription {
//         updateUser { id }
//       }`,
//       variables: { },
//       context: CTX,
//     }, (error, result) => {
//       client3.unsubscribeAll();
//       if (error) {
//         console.log(error);
//         done(new Error('todo: add real error message'));
//       }
//       if (result) {
//         assert.property(result, 'context');
//         assert.equal(result.context, CTX);
//       }
//       done();
//     });
//     setTimeout(() => {
//       subscriptionManager.publish('updateUser', {});
//     }, 100);
//   });
//
//   it('passes through websocket connection to onSubscribe', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//     client.subscribe({
//       query: `
//         subscription {
//           updateUser { id }
//         }
//       `,
//       variables: { },
//     }, () => {});
//
//     setTimeout(() => {
//       expect(onSubscribeSpy.calledOnce).to.equal(true);
//       expect(onSubscribeSpy.getCall(0).args[2]).to.not.equal(undefined);
//       done();
//     }, 100);
//   });
//
//   it('does not send more subscription data after client unsubscribes', function() {
//     const client4 = new Client(`ws://localhost:${TEST_PORT}/`);
//     setTimeout(() => {
//       let subId = client4.subscribe({
//         query:
//         `subscription {
//           updateUser { id }
//         }`,
//         operationName: 'useInfo',
//         variables: {
//           id: 3,
//         },
//         }, function(error, result) {
//           //do nothing
//         }
//       );
//       client4.unsubscribe(subId);
//     }, 100);
//     setTimeout(() => {
//       subscriptionManager.publish('user', {});
//     }, 200);
//
//     client4.client.onmessage = (message) => {
//       if (JSON.parse(message.data).type === SUBSCRIPTION_DATA) {
//         done(new Error('todo: add real error message'));
//       }
//     };
//   });
//
//   it('rejects a client that does not specify a supported protocol', (done) => {
//     const client = new WebSocket(`ws://localhost:${TEST_PORT}/`);
//     client.onerror = (message) => {
//       done();
//     };
//   });
//
//   it('rejects unparsable message', (done) => {
//     const client = new WebSocket(`ws://localhost:${TEST_PORT}/`, GRAPHQL_SUBSCRIPTIONS);
//     client.onmessage = (message) => {
//       let messageData = JSON.parse(message.data);
//       assert.equal(messageData.type, SUBSCRIPTION_FAIL);
//       assert.isAbove(messageData.payload.errors.length, 0, 'Number of errors is greater than 0.');
//       client.close();
//       done();
//     };
//     client.onopen = () => {
//       client.send('HI');
//     };
//   });
//
//   it('rejects nonsense message', (done) => {
//     const client = new WebSocket(`ws://localhost:${TEST_PORT}/`, GRAPHQL_SUBSCRIPTIONS);
//     client.onmessage = (message) => {
//       const messageData = JSON.parse(message.data);
//       assert.equal(messageData.type, SUBSCRIPTION_FAIL);
//       assert.isAbove(messageData.payload.errors.length, 0, 'Number of errors is greater than 0.');
//       client.close();
//       done();
//     };
//     client.onopen = () => {
//       client.send(JSON.stringify({}));
//     };
//   });
//
//   it('sends back any type of error', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//     client.subscribe({
//       query:
//         `invalid useInfo {
//           error
//         }`,
//       variables: {},
//     }, (errors) => {
//       client.unsubscribeAll();
//       expect(errors.length).to.be.above(0);
//       done();
//     });
//   });
//
//   it('sends a keep alive signal in the socket', (done) => {
//     const client = new WebSocket(`ws://localhost:${KEEP_ALIVE_TEST_PORT}/`, GRAPHQL_SUBSCRIPTIONS);
//     let yieldCount = 0;
//     client.onmessage = (message) => {
//       const parsedMessage = JSON.parse(message.data);
//       if (parsedMessage.type === SUBSCRIPTION_KEEPALIVE) {
//         yieldCount += 1;
//         if (yieldCount > 1) {
//           client.close();
//           done();
//         }
//       }
//     };
//   });
// });
