import { expect } from 'chai'
import crypto from 'crypto'
import ctpClientBuilder from '../../src/ctp.js'
import constants from '../../src/config/constants.js'
import { createAddTransactionAction } from '../../src/paymentHandler/payment-utils.js'
import config from '../../src/config/config.js'
import { overrideGenerateIdempotencyKeyConfig } from '../test-utils.js'

const {
  CTP_ADYEN_INTEGRATION,
  CTP_INTERACTION_TYPE_REFUND,
  CTP_PAYMENT_CUSTOM_TYPE_KEY,
} = constants

describe('::refund::', () => {
  const commercetoolsProjectKey = config.getAllCtpProjectKeys()[0]
  const adyenMerchantAccount = config.getAllAdyenMerchantAccounts()[0]
  const idempotencyKey1 = crypto.randomBytes(20).toString('hex')
  const idempotencyKey2 = crypto.randomBytes(20).toString('hex')
  let ctpClient

  beforeEach(async () => {
    const ctpConfig = config.getCtpConfig(commercetoolsProjectKey)
    ctpClient = await ctpClientBuilder.get(ctpConfig)
  })

  function assertIdempotencyKey(interfaceInteraction, refundTransaction) {
    const adyenRequest = JSON.parse(interfaceInteraction.fields.request)
    const adyenRequestBody = JSON.parse(adyenRequest.body)
    if (adyenRequestBody.modificationAmount.value === 100) {
      expect(adyenRequest.headers['Idempotency-Key']).to.equal(
        refundTransaction.id
      )
    } else {
      expect(adyenRequest.headers['Idempotency-Key']).to.equal(
        refundTransaction.custom?.fields?.idempotencyKey
      )
    }
  }

  it(
    'given a payment with "authorization success transaction" ' +
      'when multiple "refund initial transactions" are added ' +
      'then Adyen should response with [refund-received] for each transaction ' +
      'and payment should have "refund pending transactions"',
    async () => {
      overrideGenerateIdempotencyKeyConfig(true)
      const paymentDraft = {
        amountPlanned: {
          currencyCode: 'EUR',
          centAmount: 1000,
        },
        paymentMethodInfo: {
          paymentInterface: CTP_ADYEN_INTEGRATION,
        },
        custom: {
          type: {
            typeId: 'type',
            key: CTP_PAYMENT_CUSTOM_TYPE_KEY,
          },
          fields: {
            adyenMerchantAccount,
            commercetoolsProjectKey,
          },
        },
        transactions: [
          {
            type: 'Authorization',
            amount: {
              currencyCode: 'EUR',
              centAmount: 1000,
            },
            interactionId: '883592826488441K',
            state: 'Success',
          },
        ],
      }

      const { body: payment } = await ctpClient.create(
        ctpClient.builder.payments,
        paymentDraft
      )

      const { statusCode, body: refundPayment } = await ctpClient.update(
        ctpClient.builder.payments,
        payment.id,
        payment.version,
        [
          createAddTransactionAction({
            type: 'Refund',
            state: 'Initial',
            currency: 'EUR',
            amount: 500,
            custom: {
              type: {
                typeId: 'type',
                key: 'ctp-adyen-integration-transaction-payment-type',
              },
              fields: {
                idempotencyKey: idempotencyKey1,
              },
            },
          }),
          createAddTransactionAction({
            type: 'Refund',
            state: 'Initial',
            currency: 'EUR',
            amount: 300,
            custom: {
              type: {
                typeId: 'type',
                key: 'ctp-adyen-integration-transaction-payment-type',
              },
              fields: {
                idempotencyKey: idempotencyKey2,
              },
            },
          }),
          createAddTransactionAction({
            type: 'Refund',
            state: 'Initial',
            currency: 'EUR',
            amount: 100,
          }),
        ]
      )

      expect(statusCode).to.be.equal(200)

      expect(refundPayment.transactions).to.have.lengthOf(4)
      const refundTransactions = [
        refundPayment.transactions[1],
        refundPayment.transactions[2],
        refundPayment.transactions[3],
      ]
      for (const refundTransaction of refundTransactions) {
        expect(refundTransaction.type).to.equal('Refund')
        expect(refundTransaction.state).to.equal('Pending')
      }

      const interfaceInteractions = refundPayment.interfaceInteractions.filter(
        (interaction) => interaction.fields.type === CTP_INTERACTION_TYPE_REFUND
      )

      for (const interfaceInteraction of interfaceInteractions) {
        const adyenResponse = JSON.parse(interfaceInteraction.fields.response)
        expect(adyenResponse.response).to.equal('[refund-received]')
        const refundTransaction = refundTransactions.find(
          (transaction) =>
            transaction.interactionId === adyenResponse.pspReference
        )
        expect(refundTransaction).to.exist
        assertIdempotencyKey(interfaceInteraction, refundTransaction)
      }
    }
  )
})
