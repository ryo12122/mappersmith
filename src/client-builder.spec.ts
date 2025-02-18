import { ClientBuilder, GatewayConstructor } from './client-builder'
import { Manifest, GlobalConfigs } from './manifest'
import { Gateway, GatewayConfiguration } from './gateway/types'
import Request from './request'
import { getManifest, getManifestWithResourceConf } from '../spec/ts-helper'

describe('ClientBuilder', () => {
  let GatewayClassFactory: () => GatewayConstructor
  let configs: GlobalConfigs
  let gatewayClass: jest.Mock<Gateway>
  const gatewayInstanceMock = jest.fn()
  const gatewayInstance = { call: gatewayInstanceMock }

  beforeEach(() => {
    gatewayClass = jest.fn(() => gatewayInstance as unknown as Gateway)
    GatewayClassFactory = () => gatewayClass
    configs = {
      context: {},
      middleware: [],
      Promise,
      fetch,
      maxMiddlewareStackExecutionAllowed: 2,
      gateway: null,
      gatewayConfigs: {
        Fetch: { config: 'configs' },
      } as GatewayConfiguration,
    }
  })

  it('creates an object with all resources, methods, and a reference to the manifest', () => {
    const manifest = getManifest()
    const clientBuilder = new ClientBuilder(manifest, GatewayClassFactory, configs)
    const client = clientBuilder.build()
    expect(client.User).toEqual(expect.any(Object))
    expect(client.User.byId).toEqual(expect.any(Function))

    expect(client.Blog).toEqual(expect.any(Object))
    expect(client.Blog.post).toEqual(expect.any(Function))
    expect(client.Blog.addComment).toEqual(expect.any(Function))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any)._manifest instanceof Manifest).toEqual(true)
  })

  it('accepts custom gatewayConfigs', async () => {
    const customGatewayConfigs = { Mock: { custom: 'configs' } }
    const manifest = getManifest([], customGatewayConfigs)
    const clientBuilder = new ClientBuilder(manifest, GatewayClassFactory, configs)
    const client = clientBuilder.build()

    gatewayInstance.call.mockReturnValue(Promise.resolve('value'))
    const response = await client.User.byId({ id: 1 })
    expect(response).toEqual('value')
    expect(gatewayClass).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        Fetch: { config: 'configs' },
        Mock: { custom: 'configs' },
      })
    )

    expect(gatewayInstance.call).toHaveBeenCalled()
  })

  it('accepts manifest level resource configs', async () => {
    const manifest = getManifestWithResourceConf()

    const configs = {
      context: {},
      middleware: [],
      Promise,
      fetch,
      maxMiddlewareStackExecutionAllowed: 2,
      gateway: null,
      gatewayConfigs: {
        Fetch: { config: 'configs' },
      } as GatewayConfiguration,
    }

    GatewayClassFactory = () => gatewayClass
    const clientBuilder = new ClientBuilder(manifest, GatewayClassFactory, configs)
    const client = clientBuilder.build()

    gatewayInstance.call.mockReturnValue(Promise.resolve('value'))
    const response = await client.Blog.post({ customAttr: 'blog post' })
    expect(response).toEqual('value')
    expect(gatewayClass).toHaveBeenCalledWith(expect.any(Request), configs.gatewayConfigs)
    expect(gatewayInstance.call).toHaveBeenCalled()

    const request = gatewayClass.mock.calls[0][0]
    expect(request).toEqual(expect.any(Request))
    expect(request.method()).toEqual('post')
    expect(request.host()).toEqual('http://example.org')
    expect(request.path()).toEqual('/blogs')
    expect(request.body()).toEqual('blog post')
  })

  describe('when a resource method is called', () => {
    it('calls the gateway with the correct request', async () => {
      const manifest = getManifest()
      const clientBuilder = new ClientBuilder(manifest, GatewayClassFactory, configs)
      const client = clientBuilder.build()

      gatewayInstance.call.mockReturnValue(Promise.resolve('value'))
      const response = await client.User.byId({ id: 1 })
      expect(response).toEqual('value')
      expect(gatewayClass).toHaveBeenCalledWith(expect.any(Request), configs.gatewayConfigs)
      expect(gatewayInstance.call).toHaveBeenCalled()

      const request = gatewayClass.mock.calls[0][0]
      expect(request).toEqual(expect.any(Request))
      expect(request.method()).toEqual('get')
      expect(request.host()).toEqual('http://example.org')
      expect(request.path()).toEqual('/users/1')
      expect(request.params()).toEqual({ id: 1 })
    })
  })

  describe('when manifest is not defined', () => {
    it('raises error', () => {
      // @ts-expect-error Must override TS warning:
      expect(() => new ClientBuilder()).toThrowError('[Mappersmith] invalid manifest (undefined)')
    })
  })

  describe('when gatewayClass is not defined', () => {
    it('raises error', () => {
      const manifest = getManifest()
      // @ts-expect-error Must override TS warning:
      expect(() => new ClientBuilder(manifest, null)).toThrowError(
        '[Mappersmith] gateway class not configured (configs.gateway)'
      )
    })
  })

  describe('when Promise is not defined', () => {
    it('raises error', () => {
      const manifest = getManifest()
      const badConfig = { ...configs }
      // @ts-expect-error Must override TS warning:
      delete badConfig['Promise']
      expect(() => new ClientBuilder(manifest, GatewayClassFactory, badConfig)).toThrowError(
        '[Mappersmith] Promise not configured (configs.Promise)'
      )
    })
  })

  describe('when a resource path is not defined', () => {
    it('raises error', () => {
      const manifest = { host: 'host', resources: { User: { all: {} } } }
      // @ts-expect-error Must override TS warning about path missing:
      expect(() => new ClientBuilder(manifest, gatewayClass, configs).build()).toThrowError(
        '[Mappersmith] path is undefined for resource "User" method "all"'
      )
    })
  })
})
