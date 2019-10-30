const Joi = require('@hapi/joi')
const { getNestedVal } = require('ivory-shared/lib').utils

class DeclarationHandlers extends require('../handlers') {
  async reference () {
    throw new Error(`"reference" function must be declared in ${this.constructor.name} class`)
  }

  get description () {
    throw new Error(`"description" getter must be declared in ${this.constructor.name} class`)
  }

  get declaration () {
    throw new Error(`"declaration" getter must be declared in ${this.constructor.name} class`)
  }

  get schema () {
    return Joi.object({
      declaration: Joi.string().valid(this.declaration).required(),
      description: Joi.string().trim().max(this.maxFreeTextLength).required()
    })
  }

  async errorMessages (request) {
    const reference = await this.reference(request)
    const details = reference[this.declaration]
    return {
      declaration: {
        'any.allowOnly': `Select if you declare ${details}`,
        'any.required': `Select if you declare ${details}`
      },
      description: {
        'any.empty': 'Enter an explanation',
        'any.required': 'Enter an explanation',
        'string.max': `Explanation must be ${this.maxFreeTextLength} characters or fewer`
      }
    }
  }

  getDeclarationLabel (reference) {
    return `I declare ${reference[this.declaration]}`
  }

  // Overrides parent class handleGet
  async handleGet (request, h, errors) {
    const reference = await this.reference(request)
    const { Model } = this
    const model = await Model.get(request) || {}
    this.viewData = {
      declaration: this.declaration,
      declarationLabel: await this.getDeclarationLabel(reference),
      declarationChecked: model[this.declaration] || !!getNestedVal(request, 'payload.declaration'),
      description: model[this.description],
      descriptionLabel: `Explain how you know ${reference[this.declaration]}`
    }
    return super.handleGet(request, h, errors)
  }

  // Overrides parent class handlePost
  async handlePost (request, h) {
    const { Model } = this
    const model = await Model.get(request) || {}
    model[this.declaration] = true
    model[this.description] = request.payload.description
    await Model.set(request, model)
    return super.handlePost(request, h)
  }
}

module.exports = DeclarationHandlers
