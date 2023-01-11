// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'chai'
// eslint-disable-next-line import/no-extraneous-dependencies
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { getLatestInterfaceInteraction } from '../../src/paymentHandler/payment-utils.js'
import c from '../../src/config/constants.js'

async function pasteValue(page, selector, value) {
  return page.evaluate(
    (data) => {
      // eslint-disable-next-line no-undef
      document.querySelector(data.selector).value = data.value
    },
    { selector, value }
  )
}

async function executeInAdyenIframe(page, selector, executeFn) {
  for (const frame of page.mainFrame().childFrames()) {
    const elementHandle = await frame.$(selector)
    if (elementHandle) {
      await executeFn(elementHandle, frame)
      break
    }
  }
}

async function initPuppeteerBrowser() {
  return puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      // user-agent is overriden to bypass the "reminder" page of localtunnel module
      '--user-agent=curl/7.64.1',
    ],
  })
}

async function getCreateSessionRequest(clientKey) {
  // TODO : Please check whether adyen apiKey is required here. Supposing it should be provided already in handler in extension module
  return JSON.stringify({
    amount: {
      currency: 'EUR',
      value: 1000,
    },
    reference: new Date().getTime(),
    returnUrl: 'https://ctp-adyen-integration-tests.loca.lt/return-url',
  })
}

function assertPayment(
  payment,
  finalAdyenPaymentInteractionName = 'submitAdditionalPaymentDetails'
) {
  const {
    [`${finalAdyenPaymentInteractionName}Response`]:
      finalAdyenPaymentResponseString,
  } = payment.custom.fields
  const finalAdyenPaymentResponse = JSON.parse(finalAdyenPaymentResponseString)
  expect(finalAdyenPaymentResponse.resultCode).to.equal(
    'Authorised',
    `resultCode is not Authorised: ${finalAdyenPaymentResponseString}`
  )
  expect(finalAdyenPaymentResponse.pspReference).to.match(
    /[A-Z0-9]+/,
    `pspReference does not match '/[A-Z0-9]+/': ${finalAdyenPaymentResponseString}`
  )

  const finalAdyenPaymentInteraction = getLatestInterfaceInteraction(
    payment.interfaceInteractions,
    finalAdyenPaymentInteractionName
  )
  expect(finalAdyenPaymentInteraction.fields.response).to.equal(
    finalAdyenPaymentResponseString
  )

  expect(payment.transactions).to.have.lengthOf(1)
  const transaction = payment.transactions[0]
  expect(transaction.state).to.equal('Success')
  expect(transaction.type).to.equal('Authorization')
  expect(transaction.interactionId).to.equal(
    finalAdyenPaymentResponse.pspReference
  )
  expect(transaction.amount.centAmount).to.equal(
    payment.amountPlanned.centAmount
  )
  expect(transaction.amount.currencyCode).to.equal(
    payment.amountPlanned.currencyCode
  )
}
async function createPayment(
  ctpClient,
  adyenMerchantAccount,
  commercetoolsProjectKey,
  paymentRequest,
  currency = 'EUR'
) {
  const paymentDraft = {
    amountPlanned: {
      currencyCode: currency,
      centAmount: 1000,
    },
    paymentMethodInfo: {
      paymentInterface: c.CTP_ADYEN_INTEGRATION,
    },
    custom: {
      type: {
        typeId: 'type',
        key: c.CTP_PAYMENT_CUSTOM_TYPE_KEY,
      },
      fields: {
        adyenMerchantAccount,
        commercetoolsProjectKey,
        paymentRequest,
      },
    },
  }

  const { body: payment } = await ctpClient.create(
    ctpClient.builder.payments,
    paymentDraft
  )
  return payment
}
async function createPaymentSession(
  ctpClient,
  adyenMerchantAccount,
  commercetoolsProjectKey,
  createSessionRequest,
  currency = 'EUR'
) {
  const paymentDraft = {
    amountPlanned: {
      currencyCode: currency,
      centAmount: 1000,
    },
    paymentMethodInfo: {
      paymentInterface: c.CTP_ADYEN_INTEGRATION,
    },
    custom: {
      type: {
        typeId: 'type',
        key: c.CTP_PAYMENT_CUSTOM_TYPE_KEY,
      },
      fields: {
        adyenMerchantAccount,
        commercetoolsProjectKey,
        createSessionRequest,
      },
    },
  }

  const { body: payment } = await ctpClient.create(
    ctpClient.builder.payments,
    paymentDraft
  )
  return payment
}

function serveFile(pathName, req, res) {
  const resolvedBase = path.resolve(pathName)
  const fileLoc = path.join(resolvedBase)

  fs.readFile(fileLoc, (err, data) => {
    if (err) {
      res.writeHead(404, 'Not Found')
      res.write('404: File Not Found!')
      return res.end()
    }

    res.statusCode = 200

    res.write(data)
    return res.end()
  })
}

function getRequestParams(url) {
  const queries = url.split('?')
  const result = {}
  if (queries.length >= 2) {
    queries[1].split('&').forEach((item) => {
      try {
        result[item.split('=')[0]] = item.split('=')[1]
      } catch (e) {
        result[item.split('=')[0]] = ''
      }
    })
  }
  return result
}

export {
  pasteValue,
  executeInAdyenIframe,
  assertPayment,
  createPayment,
  createPaymentSession,
  initPuppeteerBrowser,
  serveFile,
  getCreateSessionRequest,
  getRequestParams,
}
