import { executeInAdyenIframe } from '../e2e-test-utils.js'
import MakePaymentFormPage from './MakePaymentFormPage.js'

export default class CreditCardMakePaymentFormPage extends MakePaymentFormPage {
  async getMakePaymentRequest({
    creditCardNumber,
    creditCardDate,
    creditCardCvc,
    clientKey,
  }) {
    await this.generateAdyenMakePaymentForm(clientKey)
    await executeInAdyenIframe(this.page, '#encryptedCardNumber', (el) =>
      el.type(creditCardNumber)
    )
    await executeInAdyenIframe(this.page, '#encryptedExpiryDate', (el) =>
      el.type(creditCardDate)
    )
    await executeInAdyenIframe(this.page, '#encryptedSecurityCode', (el) =>
      el.type(creditCardCvc)
    )
    return this.getMakePaymentRequestTextAreaValue()
  }
}
