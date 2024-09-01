import { describe, it } from 'node:test'
import assert from 'node:assert'
import { makeApp } from '../lib/app.js'
import bots from './fixtures/bots.js'

describe('app', async () => {
  const databaseUrl = 'sqlite::memory:'
  const origin = 'https://botsrodeo.test'
  let app = null
  it('should be a function', async () => {
    assert.strictEqual(typeof makeApp, 'function')
  })
  it('should return a function', async () => {
    app = await makeApp(databaseUrl, origin, bots)
    assert.strictEqual(typeof app, 'function')
  })
})
