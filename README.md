# nexus

- [graphql-nexus/nexus](https://github.com/graphql-nexus/nexus)
- [doc](https://nexusjs.org/docs/getting-started/tutorial/chapter-introduction)

## Setup

### Project

```bash
yarn init
yarn add nexus graphql apollo-server
yarn add --dev typescript ts-node-dev
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "commonjs",
    "lib": ["esnext"],
    "strict": true,
    "rootDir": ".",
    "outDir": "dist",
    "sourceMap": true,
    "esModuleInterop": true
  }
}
```

`package.json`

```json
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "ts-node-dev --transpile-only --no-notify api/app.ts",
    "build": "tsc"
  },
```

### Create app layout

```bash
mkdir api
```

`api/schema.ts`

```ts
import { makeSchema } from 'nexus'
import { join } from 'path'

export const schema = makeSchema({
  types: [], // to construct GraphQL schema
  outputs: {
    // where nexus should write the generated TypeScript definition types
    typegen: join(__dirname, '..', 'nexus-typegen.ts'),
    // where nexus should write the SDL version of GraphQL schema
    schema: join(__dirname, '..', 'schema.graphql'),
  },
})
```

`api/server.ts`

```ts
import { ApolloServer } from 'apollo-server'
import { schema } from './schema'

export const server = new ApolloServer({ schema })
```

`api/app.ts`

```ts
import { server } from './server'

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
})
```

### Run

```bash
yarn run dev
```

[http://localhost:4000](http://localhost:4000)

---

## Writing first schema

- Writing GraphQL objects
- Exposing GraphQL objects for query operations
- GraphQL SDL file generation
- Enhanced type safety & autocompletion

### Reflection

Nexus has an unconventional concept called "Reflection".  

- Generating TypeScript types to give resolvers complete type safety
- Generating an SDL file

### Model the domain

```bash
mkdir api/graphql
```

`api/graphql/Post.ts`

```ts
import { objectType } from 'nexus'

export const Post = objectType({
  name: 'Post',            // <- Name of your type
  definition(t) {
    t.int('id')            // <- Field named `id` of type `Int`
    t.string('title')      // <- Field named `title` of type `String`
    t.string('body')       // <- Field named `body` of type `String`
    t.boolean('published') // <- Field named `published` of type `Boolean`
  },
})
```

`api/graphql/index.ts`

```ts
export * from './Post'
```

`api/schema.ts`

```ts
import * as types from './graphql'

const schema = makeSchema({
  types,
  // outputs ...
})
```

### SDL: Schema Definition Language

There's now a new `schema.graphql` file at your project root.

Benefits:

1. For users familiar with SDL
2. SDL syntax makes it an accessible way for others

### Query: modular

`api/graphql/Post.ts`

```ts
import { extendType } from 'nexus'

export const PostQuery = extendType({
  type: 'Query',                         // like `schema.objectType` but `type` (not `name`)
  definition(t) {
    // default: nullable
    // field type is list: [Post]
    // first argument: field name
    // field type: Post
    t.nonNull.list.field('drafts', {
      type: 'Post',
      resolve() {
        return [{ id: 1, title: 'Nexus', body: '...', published: false }]
      }
    })
    /* or
      t.field('drafts', {
        type: nonNull(list('Post')),
        resolve() {
          return [{ id: 1, title: 'Nexus', body: '...', published: false }]
        }
      })
    */
  },
})
```

Run in GraphQL playground:

```gql
{
  drafts {
    id
    title
    body
    published
  }
}
```

Return:

```json
{
  "data": {
    "drafts": [
      {
        "id": 1,
        "title": "Nexus",
        "body": "...",
        "published": false
      }
    ]
  }
}
```

---

## Mutations

### Wire up the context

*GraphQL context*: a plain JavaScript object ahred across all resolvers

type definition: `api/db.ts`

```ts
export interface Post {
  id: number
  title: string
  body: string
  published: boolean
}

export interface Db {
  posts: Post[]
}

export const db: Db = {
  posts: [{ id: 1, title: 'Nexus', body: '...', published: false }],
}
```

1. Pass the `db` object to GraphQL server context
2. Let Nexus know what the type of context is

`api/context.ts`

```ts
import { Db, db } from './db'

export interface Context {
  db: Db
}

export const context = {
  db
}
```

`api/server.ts`

```ts
import { context } from './context'

export const server = new ApolloServer({
  schema,
  context 
})
```

`api/schema.ts`

```ts
export const schema = makeSchema({
  contextType: {
    module: join(__dirname, './context.ts'),
    export: 'ContextModule',
  },
})
```

### Use the context

`api/graphql/Post.ts`

```ts
resolve(_root, _args, ctx) { // context is the 3rd parameter.
  return ctx.db.posts.filter(p => p.published === false) // filter un-published posts
},
```

### first mutation

`api/graphql/Post.ts`

```ts
import { stringArg, nonNull } from 'nexus'

export const PostMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('createDraft', {
      type: 'Post',
      args: { // define its args
        title: nonNull(stringArg()), // helper
        body: nonNull(stringArg()),
      },
      resolve(_root, args, ctx) {
        const draft = {
          id: ctx.db.posts.length + 1,
          title: args.title, // 
          body: args.body,
          published: false,
        }
        ctx.db.posts.push(draft)
        return draft
      },
    })
  },
})
```

### Add domain

```ts
import { intArg } from 'nexus'

export const PostQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('posts', {
      type: 'Post',
      resolve(_root, _args, ctx) {
        return ctx.db.posts.filter(p => p.published === true)
      },
    })
  },
})

export const PostMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('publish', {
      type: 'Post',
      args: { // define its args
        draftId: nonNull(intArg()),
      },
      resolve(_root, args, ctx) {
        let draftToPublish = ctx.db.post.find(p => p.id === args.draftId)
        if (!draftToPublish) {
          throw new Error('Could not find draft with id ' + args.draftId)
        }
        draftToPublish.published = true
        return draftToPublish
      },
    })
  },
})
```

### Try

```gql
mutation {
  publish(draftId: 1) {
    id
    title
    body
    published
  }
}
```

```gql
query {
  posts {
    id
    title
    body
    published
  }
}
```

`schema.graphql`

```gql
type Mutation {
  createDraft(body: String!, title: String!): Post!
  publish(draftId: Int!): Post
}

type Post {
  body: String
  id: Int
  published: Boolean
  title: String
}

type Query {
  drafts: [Post]!
  posts: [Post]
}
```

---

## Test

![](https://jfiaffe.files.wordpress.com/2014/09/tests-pyramid.png)

System testing means tests that will run operations against your API just like a real client would. 

### Jest

```bash
yarn add --dev jest @types/jest ts-jest graphql-request get-port
```

#### Error

> Cannot find module 'prettier' from 'node_modules/jest-jasmine2/build/setup_jest_globals.js'

```bash
yarn add --dev --exact prettier
```

`package.json`:

```json
"scripts": {
  "generate": "ts-node --transpile-only api/schema",
  "test": "yarn run generate && jest"
},
"jest": {
  "preset": "ts-jest",
  "globals": {
    "ts-jest": {
      "diagnostics": { "warnOnly": true }
    }
  },
  "testEnvironment": "node"
}
```

```bash
mkdir tests && touch tests/Post.test.ts
```

### Testing the `publish` mutation

a small utility that we'll call `createTestContext`, which is designed for running integration tests.

```bash
touch tests/__helpers.ts
```

```ts
// prefix `__` matches that of jest's for snapshot folders `__snapshots__`

import { ServerInfo } from 'apollo-server'
import getPort, { makeRange } from 'get-port'
import { GraphQLClient } from 'graphql-request'
import { server } from '../api/server'

type TestContext = {
  client: GraphQLClient
}

export function createTestContext(): TestContext {
  let ctx = {} as TestContext
  const graphqlCtx = graphqlTestContext()

  beforeEach(async () => {
    const client = await graphqlCtx.before() // Start the server

    // Save a GraphQL client
    Object.assign(ctx, {
      client,
    })
  })

  afterEach(async () => {
    await graphqlCtx.after() // Stop the server
  })

  // Return an object containing a configured GraphQL client
  // to easily send queries to your GraphQL server
  return ctx
}

function graphqlTestContext() {
  let serverInstance: ServerInfo | null = null

  return {
    async before() {
      // This is useful as Jest runs all the tests in a same file concurrently by default
      const port = await getPort({ port: makeRange(4000, 6000) })

      // Start the GraphQL server before a test start
      serverInstance = await server.listen({ port })

      // each test can easily send queries to the spawned GraphQL server
      return new GraphQLClient(`http://localhost:${port}`)
    },
    async after() {
      serverInstance?.server.close() // Stop the server after each test is done
    },
  }
}
```

`api/db.ts`:

```ts
export const db: Db = {
  posts: [],
}
```

`tests/Post.test.ts`:

```ts
import { createTestContext } from './__helpers'

const ctx = createTestContext()

it('ensures that a draft can be created and published', async () => {
  // Create a new draft
  // Run operations against our API.
  const draftResult = await ctx.client.request(`
    mutation {
      createDraft(title: "Nexus", body: "...") {
        id
        title
        body
        published
      }
    }
  `)

  // Snapshot that draft and expect `published` to be false
  // The result will be snapshoted inline allowing us
  // to see the input and output collocated!
  expect(draftResult).toMatchInlineSnapshot()

  // Publish the previously created draft
  const publishResult = await ctx.client.request(
    `
    mutation publishDraft($draftId: Int!) {
      publish(draftId: $draftId) {
        id
        title
        body
        published
      }
    }
    `,
    { draftId: draftResult.createDraft.id }
  )

  // Snapshot the published draft and expect `published` to be true
  expect(publishResult).toMatchInlineSnapshot()
})
```

### Try out

```bash
yarn run test
```

```bash
$ yarn run generate && jest
$ ts-node --transpile-only api/schema
 PASS  tests/Post.test.ts
  ✓ ensures that a draft can be created and published (97 ms)

 › 2 snapshots written.
Snapshot Summary
 › 2 snapshots written from 1 test suite.

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   2 written, 2 total
Time:        1.753 s
Ran all test suites.
✨  Done in 3.26s.
```

2 Snapshots written:

```ts
expect(draftResult).toMatchInlineSnapshot(`
  Object {
    "createDraft": Object {
      "body": "...",
      "id": 1,
      "published": false,
      "title": "Nexus",
    },
  }
`)
expect(publishResult).toMatchInlineSnapshot(`
  Object {
    "publish": Object {
      "body": "...",
      "id": 1,
      "published": true,
      "title": "Nexus",
    },
  }
`)
```

### Plugin

VSCode plugin: [snapshot-tools](https://marketplace.visualstudio.com/items?itemname=asvetliakov.snapshot-tools)

`tsconfig.json` or `jsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-snapshots-plugin",
        "snapshotDir": "__snapshots__",
        "snapshotCallIdentifiers": [
          "toMatchInlineSnapshot"
        ]
      }
    ],
  }
}
```

`tests/Post.test.ts`

```ts
expect(draftResult).toMatchSnapshot()
expect(publishResult).toMatchSnapshot()
```

```bash
yarn run test
```

Result in `tests/__sanpshots__/Post.test.ts.snap`:

```ts
exports[`ensures that a draft can be created and published 1`] = `
Object {
  "createDraft": Object {
    "body": "...",
    "id": 1,
    "published": false,
    "title": "Nexus",
  },
}
`;

exports[`ensures that a draft can be created and published 2`] = `
Object {
  "publish": Object {
    "body": "...",
    "id": 1,
    "published": true,
    "title": "Nexus",
  },
}
`;
```

---

## Prisma

```bash
yarn add @prisma/client && yarn add --dev @prisma/cli
```

```bash
npx prisma init
```

Your Prisma schema was created at `prisma/schema.prisma`.

`.env` → `prisma/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"
```

### Docker Run

in another terminal:

```bash
docker run --rm --publish 5432:5432 -e POSTGRES_PASSWORD=postgres --name nexus-tutorial-postgres postgres:10
```

## DB Schema

`prisma/schema.prisma`

```ts
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  body      String
  published Boolean
}
```

Migrate:

```bash
npx prisma migrate dev --preview-feature
```

### Access your database

`api/db.ts`

```ts
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

/*
export interface Post {
  id: number
  title: string
  body: string
  published: boolean
}

export interface Db {
  posts: Post[]
}

export const db: Db = {
  // posts: [{ id: 1, title: 'Nexus', body: '...', published: false }],
  posts: [],
}
*/
```

`api/context.ts`:

```ts
import { db } from './db'
import { PrismaClient } from '@prisma/client'

export interface Context {
  db: PrismaClient
}

export const context = {
  db,
}
```

Generate `./node_modules/@prisma/client`:

```bash
npx prisma generate
```

`api/graphql/Post.ts`:

```ts
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
```

### Try playground

```bash
yarn run dev
```

[http://localhost:4000](http://localhost:4000)

```gql
mutation {
  createDraft(title: "Hello", body: "World") {
    id
    title
    body
    published
  }
}
```

```gql
mutation {
  createDraft(title: "Hello", body: "There") {
    id
  }
}
```

```gql
query {
  drafts {
    id
    title
    body
    published
  }
}
```

```gql
mutation {
  publish(draftId: 1) {
    id
    title
    body
    published
  }
}
```

```gql
query {
  posts {
    id
    title
    body
    published
  }
}
```

---

## Testing with Prisma

```bash
yarn add --dev pg @types/pg nanoid
```

### Helpers

[tests/__helpers.ts](tests/__helpers.ts)

1. Push a randomly generated schema into the database before each test. This ensure that your tests can add data to an "isolated" and clean database.
2. Flush the changed schema after each test
3. Add an instance of a Prisma Client connected to the schema specifically for the test

### Updating our test

[tests/Post.test.ts](tests/Post.test.ts)

```ts
const persistedData = await ctx.db.post.findMany()
expect(persistedData).toMatchSnapshot()
```

```bash
yarn run test
```