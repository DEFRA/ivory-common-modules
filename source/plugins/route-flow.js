const { cloneDeep } = require('lodash')
const { logger } = require('defra-logging-facade')
const { getNestedVal } = require('ivory-shared/lib').utils

class Flow {
  constructor (flowConfig, handlersRelativeDir) {
    this.flowConfig = flowConfig
    this.handlersRelativeDir = handlersRelativeDir
  }

  _getHandlersClass (node) {
    return require(`${__dirname}/${this.handlersRelativeDir}/${node.handlers}`)
  }

  parseFlow (server) {
    Object.values(this.flowConfig).forEach((node) => {
      if (node.handlers) {
        const Handlers = this._getHandlersClass(node)
        const handlers = new Handlers()

        const routes = handlers.routes(getRoutes.bind(handlers)(node))

        node.handlers = handlers

        routes.forEach((route) => server.route(route))
      } else {
        throw new Error(`Expected Flow config to include the handler property for path: ${node.path}`)
      }
      switch (typeof node.next) {
        case 'string': {
          node.next = getNestedVal(this.flowConfig, node.next)
          break
        }
        case 'object': {
          const { query, result, path } = node.next
          if (query && result) {
            Object.entries(result).forEach(([key, val]) => {
              result[key] = getNestedVal(this.flowConfig, val)
            })
          } else {
            if (!path) {
              throw new Error(`Flow config not valid for path: ${node.path}`)
            }
          }
          break
        }
      }
    })
  }
}

function getRoutes (node) {
  const { path, next = {}, pageHeading = '', isQuestionPage = false, view, tags = [] } = node

  // Override getNextPath if query specified
  if (next.query) {
    const query = this[next.query]
    if (typeof query === 'function') {
      this.getNextPath = async (request) => {
        const val = await query.bind(this)(request)
        const result = next.result[val.toString()]
        if (result && result.path) {
          return result.path
        } else {
          throw new Error(`Expected route class ${this.constructor.name} to have a result after function "${next.query}" executed`)
        }
      }
    } else {
      throw new Error(`Expected route class ${this.constructor.name} to have function "${next.query}" declared`)
    }
  }

  // Override getPageHeading if query specified
  if (pageHeading && pageHeading.query) {
    const query = this[pageHeading.query]
    if (typeof query === 'function') {
      this.getPageHeading = async (request) => {
        const val = await query.bind(this)(request)
        const result = pageHeading.result[val.toString()]
        if (result) {
          return result
        } else {
          throw new Error(`Expected route class ${this.constructor.name} to have a result after function "${pageHeading.query}" executed`)
        }
      }
    } else {
      throw new Error(`Expected route class ${this.constructor.name} to have function "${pageHeading.query}" declared`)
    }
  }
  return {
    path,
    app: {
      pageHeading: typeof pageHeading === 'string' && pageHeading,
      nextPath: next.path,
      view,
      isQuestionPage,
      tags
    }
  }
}

const flow = {
  register: (server, options = {}) => {
    const { flowConfig, handlersRelativeDir } = options

    if (flowConfig) {
      this._flow = new Flow(cloneDeep(flowConfig), handlersRelativeDir)
      this._flow.parseFlow(server)
    } else {
      logger.warn('No flow config was added')
    }
  },
  Flow,
  get flow () {
    return this._flow
  }
}

exports.test = {
  Flow: flow.Flow
}
exports.flow = flow.flow

exports.plugin = {
  name: 'defra-common-flow',
  register: flow.register,
  once: true,
  pkg: require('../../package.json')
}
