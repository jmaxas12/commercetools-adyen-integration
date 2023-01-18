export default class CreateSessionFormPage {
  constructor(page, baseUrl) {
    this.page = page
    this.baseUrl = baseUrl
  }

  async goToThisPage() {
    await this.page.goto(`${this.baseUrl}/init-session-form`)
  }

  async generateAdyenCreateSessionForm(clientKey, payment) {
    const createSessionResponseStr =
      payment?.custom?.fields?.createSessionResponse
    let createSessionResponse

    createSessionResponse = JSON.parse(createSessionResponseStr)

    await this.page.waitForTimeout(5_000)

    // Put Adyen API Key into HTML for e2e test

    await this.page.type('#adyen-client-key', clientKey)
    await this.page.$eval('#adyen-client-key', (e) => e.blur())

    // Put Session ID into HTML for e2e test

    await this.page.type('#adyen-session-id', createSessionResponse.id)
    await this.page.$eval('#adyen-session-id', (e) => e.blur())

    // Put Session ID into HTML for e2e test

    await this.page.type(
      '#adyen-session-data',
      createSessionResponse.sessionData
    )
    await this.page.$eval('#adyen-session-data', (e) => e.blur())
  }

  async getInitSessionResultTextAreaValue() {
    await this.page.waitForSelector('.adyen-checkout__button--pay')
    await this.page.click('.adyen-checkout__button--pay')
    const initSessionResultTextArea = await this.page.$(
      '#adyen-init-session-result'
    )
    return (
      await initSessionResultTextArea.getProperty('innerHTML')
    ).jsonValue()
  }
}
