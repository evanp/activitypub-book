export class Authorizer {
  #PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
  #actorStorage = null
  #formatter = null
  constructor (actorStorage, formatter) {
    this.#actorStorage = actorStorage
    this.#formatter = formatter
  }

  async canRead (actor, object) {
    return (this.#formatter.isLocal(object.id))
      ? await this.#canReadLocal(actor, object)
      : await this.#canReadRemote(actor, object)
  }

  async isOwner (actor, object) {
    const owner = await this.#getOwner(object)
    return actor.id === owner.id
  }

  async sameOrigin (actor, object) {
    return (new URL(actor.id)).origin === (new URL(object.id)).origin
  }

  async #canReadLocal (actor, object) {
    const recipients = this.#getRecipients(object)
    if (!actor) {
      return recipients.has(this.#PUBLIC)
    }
    const ownerId = (await this.#getOwner(object))?.id
    if (!ownerId) {
      throw new Error(`no owner for ${object.id}`)
    }
    if (actor.id === ownerId) {
      return true
    }
    const owner = await this.#actorStorage.getActorById(ownerId)
    if (!owner) {
      throw new Error(`no actor for ${ownerId}`)
    }
    const ownerName = owner.get('preferredUsername')?.first
    if (!ownerName) {
      throw new Error(`no preferredUsername for ${owner.id}`)
    }
    if (await this.#actorStorage.isInCollection(ownerName, 'blocked', actor)) {
      return false
    }
    if (recipients.has(actor.id)) {
      return true
    }
    if (recipients.has(this.#PUBLIC)) {
      return true
    }
    const followers = this.#formatter.format({ username: ownerName, collection: 'followers' })
    if (recipients.has(followers) && await this.#actorStorage.isInCollection(ownerName, 'followers', actor)) {
      return true
    }
    return false
  }

  async #canReadRemote (actor, object) {
    return false
  }

  async #getOwner (object) {
    if (object.attributedTo) {
      return object.attributedTo.first
    } else if (object.actor) {
      return object.actor.first
    } else if (object.owner) {
      return object.owner.first
    } else {
      return null
    }
  }

  #getRecipients (activity) {
    const recipientIds = new Set()
    if (activity.to) {
      for (const to of activity.to) {
        recipientIds.add(to.id)
      }
    }
    if (activity.cc) {
      for (const cc of activity.cc) {
        recipientIds.add(cc.id)
      }
    }
    if (activity.audience) {
      for (const audience of activity.audience) {
        recipientIds.add(audience.id)
      }
    }
    if (activity.bto) {
      for (const bto of activity.bto) {
        recipientIds.add(bto.id)
      }
    }
    if (activity.bcc) {
      for (const bcc of activity.bcc) {
        recipientIds.add(bcc.id)
      }
    }
    return recipientIds
  }
}
