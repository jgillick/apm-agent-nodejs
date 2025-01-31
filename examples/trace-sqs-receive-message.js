#!/usr/bin/env node

// An example showing Elastic APM tracing the polling of messages from an AWS
// SQS queue.
//
// Warning: Running this script can incur costs on your AWS account. This will
// also call *DeleteMessage* on received messages, so do not use this on
// production queues.
//
// Prerequisites:
// - AWS credentials are setup. E.g. if using the `aws` CLI
//   (https://aws.amazon.com/cli/) works, then you should be good.
// - You have a test queue to use to receive messages from.
// - Your queue has some messages on it to receive. See the related
//   "trace-sqs-send-message.js" script.
//
// Usage:
//    node trace-sqs-receive-message.js REGION SQS-QUEUE-NAME
//
// Example:
//    node trace-sqs-receive-message.js us-west-2 my-play-queue

const apm = require('../').start({
  serviceName: 'example-trace-sqs'
})

const AWS = require('aws-sdk')

function errExit (err) {
  console.error(`${process.argv[1]}: error: ${err.toString()}`)
  process.exit(1)
}

const region = process.argv[2]
const queueName = process.argv[3]
if (!region || !queueName) {
  console.error(`usage: node ${process.argv[1]} AWS-REGION SQS-QUEUE-NAME`)
  errExit('missing arguments')
}
console.log('SQS ReceiveMessage from region=%s queueName=%s', region, queueName)

AWS.config.update({ region })
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })

// For tracing spans to be created, there must be an active transaction.
// Typically, a transaction is automatically started for incoming HTTP
// requests to a Node.js server. However, because this script is not running
// an HTTP server, we manually start a transaction. More details at:
// https://www.elastic.co/guide/en/apm/agent/nodejs/current/custom-transactions.html
const trans = apm.startTransaction('receive-message')

// 1. Get the URL for this queue.
sqs.getQueueUrl({ QueueName: queueName }, function (err, data) {
  if (err) {
    errExit(err)
  }
  const queueUrl = data.QueueUrl
  console.log('queueUrl:', queueUrl)

  // 2. Doing a long poll (up to 5s) for up to two messages.
  const params = {
    QueueUrl: queueUrl,
    AttributeNames: ['SentTimestamp'],
    MaxNumberOfMessages: 2,
    MessageAttributeNames: ['All'],
    VisibilityTimeout: 20,
    WaitTimeSeconds: 5 // long poll
  }
  sqs.receiveMessage(params, function (err, data) {
    if (err) {
      errExit(err)
    }
    process.stdout.write('receiveMessage response data: ')
    console.dir(data, { depth: 5 })

    // 3. Delete any received messages.
    if (data.Messages && data.Messages.length > 0) {
      const delEntries = data.Messages
        .map(m => { return { Id: m.MessageId, ReceiptHandle: m.ReceiptHandle } })
      sqs.deleteMessageBatch({
        QueueUrl: queueUrl,
        Entries: delEntries
      }, function (err, data) {
        if (err) {
          console.log('deleteMessageBatch err:', err)
        } else if (data && data.Failed && data.Failed.length > 0) {
          console.log('deleteMessageBatch failed to delete some messages:', data)
        }
        trans.end()
      })
    } else {
      trans.end()
    }
  })
})
