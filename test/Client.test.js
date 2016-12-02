// import { expect } from 'chai';
// import { createServer } from 'http';
// import { PubSub, SubscriptionManager } from 'graphql-subscriptions';
// import { buildSchema } from 'graphql';
// import Client from '../src/Client';
// import Server from '../src/Server';
//
// const TEST_PORT = 8089;
//
// const httpServerRaw = createServer();
// httpServerRaw.listen(TEST_PORT);
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
// describe('Client', () => {
//   let wsServer;
//
//   beforeEach(() => {
//     const pubsub = new PubSub();
//
//     const subscriptionManager = new SubscriptionManager({
//       schema,
//       pubsub,
//       setupFunctions: {},
//     });
//
//     wsServer = new Server({
//       subscriptionManager,
//     }, httpServerRaw);
//   });
//
//   afterEach(() => {
//     if (wsServer) wsServer.close();
//   });
//
//   it('emits a connect event when it connects to the server', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}`);
//
//     const timeout = setTimeout(() => {
//       throw new Error('Connect was never called');
//     }, 100);
//
//     client.on('connect', () => {
//       clearTimeout(timeout);
//       done();
//     });
//   });
//
//   it('emits a disconnect event when it disconnects from the server', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}`);
//
//     const timeout = setTimeout(() => {
//       throw new Error('Disconnect was never called');
//     }, 200);
//
//     client.on('connect', () => {
//       client.client.close();
//     });
//
//     client.on('disconnect', () => {
//       clearTimeout(timeout);
//       done();
//     });
//   });
//
//   it('emits a connect after being reconnected to the server', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}`, {
//       reconnect: true,
//     });
//
//     const timeout = setTimeout(() => {
//       throw new Error('Disconnect was never called');
//     }, 200);
//
//     function firstConnectHandler() {
//       client.off('connect', firstConnectHandler);
//       client.client.close();
//     }
//
//     let callCount = 0;
//     function reconnectHandler() {
//       callCount += 1;
//       if (callCount === 2) {
//         clearTimeout(timeout);
//         done();
//       }
//     }
//
//     client.on('connect', firstConnectHandler);
//     client.on('connect', reconnectHandler);
//   });
//
//   it('removes subscription when it unsubscribes from it', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//
//     setTimeout(() => {
//       const subId = client.subscribe(
//         {
//           query: `
//             subscription useInfo {
//               updateUser {
//                 id
//               }
//             }
//           `,
//           operationName: 'useInfo',
//           variables: {
//             id: 3,
//           },
//         },
//         () => {
//           // do nothing
//         },
//       );
//       client.unsubscribe(subId);
//       expect(client.subscriptions).to.not.have.property(subId);
//       done();
//     }, 100);
//   });
//
//   it('queues messages while websocket is still connecting', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//
//     const subId = client.subscribe({
//       query: `
//         subscription useInfo {
//           updateUser {
//             id
//           }
//         }
//       `,
//       operationName: 'useInfo',
//       variables: {
//         id: 3,
//       },
//     }, () => {});
//     expect((client).unsentMessagesQueue.length).to.equals(1);
//     client.unsubscribe(subId);
//     expect((client).unsentMessagesQueue.length).to.equals(2);
//     setTimeout(() => {
//       expect((client).unsentMessagesQueue.length).to.equals(0);
//       done();
//     }, 100);
//   });
//
//   it('should call error handler when graphql result has errors', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//
//     setTimeout(() => {
//       client.subscribe({
//         query: `
//           subscription useInfo{
//             error
//           }
//         `,
//         variables: {},
//       }, (error) => {
//         client.unsubscribeAll();
//         if (error) {
//           done();
//         } else {
//           done(new Error('Unexpected response.'));
//         }
//       });
//     }, 100);
//   });
//
//   it('should call error handler when graphql query is not valid', (done) => {
//     const client = new Client(`ws://localhost:${TEST_PORT}/`);
//
//     client.subscribe({
//       query: `
//         subscription useInfo{
//           invalid
//         }
//       `,
//       variables: {},
//     }, (error) => {
//       if (error) {
//         expect(error[0].message).to.equals('Cannot query field "invalid" on type "Subscription".');
//         done();
//       } else {
//         done(new Error('Unexpected response.'));
//       }
//     });
//   });
//
//   it('should throw an error when the susbcription times out', (done) => {
//     // hopefully 1ms is fast enough to time out before the server responds
//     const client = new Client(`ws://localhost:${TEST_PORT}/`, { timeout: 1 });
//
//     setTimeout(() => {
//       client.subscribe({
//         query:
//           `subscription useInfo{
//             error
//           }`,
//         operationName: 'useInfo',
//         variables: {},
//       }, (error) => {
//         if (error) {
//           expect(error[0].message).to.equals('Subscription timed out - no response from server');
//           done();
//         } else {
//           done(new Error('Unexpected response.'));
//         }
//       });
//     }, 100);
//   });
//
//   it('should reconnect to the server', (done) => {
//     let connections = 0;
//     let client;
//     let originalClient;
//     wsServer.on('connection', (connection) => {
//       connections += 1;
//       if (connections === 1) {
//         connection.close();
//       } else {
//         expect(client.client).to.not.be.equal(originalClient);
//         done();
//       }
//     });
//     client = new Client(`ws://localhost:${TEST_PORT}/`, { reconnect: true });
//     originalClient = client.client;
//   });
//
//   it('should resubscribe after reconnect', (done) => {
//     let hasResponded = false;
//     const client = new Client(`ws://localhost:${TEST_PORT}/`, { reconnect: true });
//     client.subscribe({
//       query: `
//         subscription useInfo {
//           invalid
//         }
//       `,
//       variables: {},
//     }, () => {
//       if (!hasResponded) {
//         hasResponded = true;
//         done();
//       } else {
//         client.close();
//       }
//     });
//   });
//
//   it('should stop trying to reconnect to the server', (done) => {
//     let connections = 0;
//     wsServer.on('connection', (connection) => {
//       connections += 1;
//       if (connections >= 1) {
//         connection.close();
//       } else {
//         throw new Error('Unexpected ammount of connections');
//       }
//     });
//
//     const client = new Client(`ws://localhost:${TEST_PORT}/`, {
//       timeout: 100,
//       reconnect: true,
//       reconnectionAttempts: 1,
//     });
//
//     setTimeout(() => {
//       expect(client.client.readyState).to.be.equal(client.client.CLOSED);
//       done();
//     }, 500);
//   });
// });
