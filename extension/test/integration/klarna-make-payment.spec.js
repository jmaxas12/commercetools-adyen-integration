import { expect } from 'chai'
import ctpClientBuilder from '../../src/ctp.js'
import config from '../../src/config/config.js'
import { initPaymentWithCart } from './integration-test-set-up.js'
import { updatePaymentWithRetry } from '../test-utils.js'

describe('::klarnaMakePayment with multiple projects use case::', () => {
  const [commercetoolsProjectKey1, commercetoolsProjectKey2] =
    config.getAllCtpProjectKeys()
  const [adyenMerchantAccount1, adyenMerchantAccount2] =
    config.getAllAdyenMerchantAccounts()

  let ctpClientProject1
  let ctpClientProject2

  beforeEach(async () => {
    const ctpConfig1 = config.getCtpConfig(commercetoolsProjectKey1)
    ctpClientProject1 = await ctpClientBuilder.get(ctpConfig1)

    const ctpConfig2 = config.getCtpConfig(commercetoolsProjectKey2)
    ctpClientProject2 = await ctpClientBuilder.get(ctpConfig2)
  })

  it(
    'given 2 different commercetools projects and payments, ' +
      'when makePayment custom field is set with Klarna Adyen request without line items,' +
      'then it should connect the 2 different adyen mechant accounts ' +
      'and should calculate correct line items for Klarna Adyen',
    async () => {
      await Promise.all([
        makePayment({
          ctpClient: ctpClientProject1,
          adyenMerchantAccount: adyenMerchantAccount1,
          commercetoolsProjectKey: commercetoolsProjectKey1,
          reference: `klarnaMakePayment1-${new Date().getTime()}`,
        }),
        makePayment({
          ctpClient: ctpClientProject2,
          adyenMerchantAccount: adyenMerchantAccount2,
          commercetoolsProjectKey: commercetoolsProjectKey2,
          reference: `klarnaMakePayment2-${new Date().getTime()}`,
        }),
      ])
    }
  )

  async function makePayment({
    ctpClient,
    adyenMerchantAccount,
    commercetoolsProjectKey,
    reference,
  }) {
    const payment = await initPaymentWithCart({
      ctpClient,
      adyenMerchantAccount,
      commercetoolsProjectKey,
    })
    const makePaymentRequestDraft = {
      riskData: {
        clientData:
          'eyJ2ZXJzaW9uIjoiMS4wLjAiLCJkZXZpY2VGaW5nZXJwcmludCI6ImRmLXRpbWVkT3V0In0=',
      },
      reference,
      paymentMethod: {
        type: 'klarna',
      },
      amount: {
        currency: 'EUR',
        value: 1000,
      },
      shopperLocale: 'de_DE',
      countryCode: 'DE',
      shopperEmail: 'youremail@email.com',
      shopperReference: 'YOUR_UNIQUE_SHOPPER_ID',
      returnUrl: 'https://www.yourshop.com/checkout/result',
    }

    const { statusCode, updatedPayment } = await updatePaymentWithRetry(
      ctpClient,
      [
        {
          action: 'setCustomField',
          name: 'makePaymentRequest',
          value: JSON.stringify(makePaymentRequestDraft),
        },
      ],
      payment
    )

    expect(statusCode).to.be.equal(200)
    const makePaymentInteraction =
      updatedPayment.interfaceInteractions[0].fields
    const makePaymentRequest = JSON.parse(makePaymentInteraction.request)
    const makePaymentResponse = JSON.parse(makePaymentInteraction.response)

    const makePaymentRequestBody = JSON.parse(makePaymentRequest.body)

    expect(makePaymentRequestBody.metadata).to.deep.equal({
      ctProjectKey: commercetoolsProjectKey,
    })
    expect(makePaymentRequestBody.merchantAccount).to.be.equal(
      adyenMerchantAccount
    )

    expect(makePaymentRequestBody.lineItems).to.have.lengthOf(3)
    expect(makePaymentResponse.resultCode).to.be.equal('RedirectShopper')
  }
})
