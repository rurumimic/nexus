import { objectType } from 'nexus'
import { extendType } from 'nexus'
import { stringArg, nonNull } from 'nexus'
import { intArg } from 'nexus'

export const Post = objectType({
  name: 'Post', // <- Name of your type
  definition(t) {
    t.int('id') // <- Field named `id` of type `Int`
    t.string('title') // <- Field named `title` of type `String`
    t.string('body') // <- Field named `body` of type `String`
    t.boolean('published') // <- Field named `published` of type `Boolean`
  },
})

export const PostQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.list.field('drafts', {
      type: 'Post',
      resolve(_root, _args, ctx) {
        /*
        return ctx.db.posts.filter((p) => p.published === false)
        */
        return ctx.db.post.findMany({ where: { published: false } })
      },
    })
    t.list.field('posts', {
      type: 'Post',
      resolve(_root, _args, ctx) {
        /*
        return ctx.db.posts.filter((p) => p.published === true)
        */
        return ctx.db.post.findMany({ where: { published: true } })
      },
    })
  },
})

export const PostMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('createDraft', {
      type: 'Post',
      args: {
        title: nonNull(stringArg()),
        body: nonNull(stringArg()),
      },
      resolve(_root, args, ctx) {
        const draft = {
          /*
          id: ctx.db.posts.length + 1,
          */
          title: args.title,
          body: args.body,
          published: false,
        }
        /*
        ctx.db.posts.push(draft)
        return draft
        */
        return ctx.db.post.create({ data: draft })
      },
    })
    t.field('publish', {
      type: 'Post',
      args: {
        // define its args
        draftId: nonNull(intArg()),
      },
      resolve(_root, args, ctx) {
        /*
        let draftToPublish = ctx.db.posts.find((p) => p.id === args.draftId)
        if (!draftToPublish) {
          throw new Error('Could not find draft with id ' + args.draftId)
        }
        draftToPublish.published = true
        return draftToPublish
        */
        return ctx.db.post.update({
          where: { id: args.draftId },
          data: {
            published: true,
          },
        })
      },
    })
  },
})
