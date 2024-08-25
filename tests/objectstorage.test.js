import { describe, it, before, after } from 'node:test'
import as2 from 'activitystrea.ms'
import assert from 'node:assert'
import { ObjectStorage, NoSuchObjectError } from '../lib/objectstorage.js'
import { Sequelize } from 'sequelize'

describe('ObjectStorage', async () => {
  let doc = null
  let doc2 = null
  let doc3 = null
  let connection = null
  let storage = null
  before(async () => {
    doc = await as2.import({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://social.example/users/test/note/1',
      type: 'Note',
      name: 'test',
      content: 'test'
    })
    doc2 = await as2.import({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://social.example/users/test/note/2',
      type: 'Note',
      name: 'test',
      content: 'test',
      inReplyTo: doc.id
    })
    doc3 = await as2.import({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://social.example/users/test/note/3',
      type: 'Note',
      name: 'test',
      content: 'test'
    })
    connection = new Sequelize('sqlite::memory:', { logging: false })
    await connection.authenticate()
  })
  after(async () => {
    await connection.close()
  })
  it('can initialize', async () => {
    storage = new ObjectStorage(connection)
    await storage.initialize()
  })
  it('can create a new object', async () => {
    await storage.create(doc)
  })
  it('can read a created object', async () => {
    await storage.read(doc.id)
  })
  it('can update a created object', async () => {
    const doc2 = await as2.import({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://social.example/users/test/note/1',
      type: 'Note',
      name: 'test2',
      content: 'test2'
    })
    await storage.update(doc2)
    const read = await storage.read(doc2.id)
    assert.equal(read.name.get('en'), 'test2')
  })
  it('can delete a created object', async () => {
    await storage.delete(doc)
    try {
      await storage.read(doc.id)
      assert.fail('should not be able to read deleted object')
    } catch (err) {
      assert.ok(err instanceof NoSuchObjectError)
    }
  })
  it('can get a collection', async () => {
    const collection = await storage.getCollection(doc.id, 'replies')
    assert.equal(typeof (collection), 'object')
    assert.equal(typeof (collection.id), 'string')
    assert.equal(collection.id, `${doc.id}/replies`)
    assert.equal(collection.type, 'https://www.w3.org/ns/activitystreams#OrderedCollection')
    assert.equal(collection.totalItems, 0)
    assert.equal(collection.first.id, `${doc.id}/replies/page/1`)
    assert.equal(collection.last.id, `${doc.id}/replies/page/1`)
  })
  it('can get a collection page', async () => {
    const page = await storage.getCollectionPage(doc.id, 'replies', 1)
    assert.equal(typeof page, 'object')
    assert.equal(page.id, `${doc.id}/replies/page/1`)
    assert.equal(page.type, 'https://www.w3.org/ns/activitystreams#OrderedCollectionPage')
    assert.equal(page.partOf.id, `${doc.id}/replies`)
    assert.ok(!page.next)
    assert.ok(!page.prev)
    assert.ok(!page.items)
  })
  it('can add to a collection', async () => {
    await storage.addToCollection(doc.id, 'replies', doc2)
    const page = await storage.getCollectionPage(doc.id, 'replies', 1)
    assert.ok(Array.from(page.items).find(item => item.id === doc2.id))
  })
  it('can check collection membership', async () => {
    assert.strictEqual(true, await storage.isInCollection(doc.id, 'replies', doc2))
    assert.strictEqual(false, await storage.isInCollection(doc.id, 'replies', doc3))
  })
  it('can remove from a collection', async () => {
    await storage.removeFromCollection(doc.id, 'replies', doc2)
    const page = await storage.getCollectionPage(doc.id, 'replies', 1)
    assert.ok(!page.items)
  })
  it('can add many items to a collection', async () => {
    for (let i = 3; i < 103; i++) {
      const reply = await as2.import({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `https://social.example/users/test/note/${i}`,
        type: 'Note',
        name: 'test',
        content: 'test',
        inReplyTo: doc.id
      })
      await storage.addToCollection(doc.id, 'replies', reply)
    }
    const collection = await storage.getCollection(doc.id, 'replies')
    assert.equal(collection.totalItems, 100)
    assert.equal(collection.first.id, `${doc.id}/replies/page/5`)
    assert.equal(collection.last.id, `${doc.id}/replies/page/1`)
    const page = await storage.getCollectionPage(doc.id, 'replies', 3)
    assert.ok(page.next)
    // assert.ok(page.prev)
    assert.ok(page.items)
    assert.equal(Array.from(page.items).length, 20)
  })
})
