import { makeSchema } from 'nexus'
import { join } from 'path'
import * as types from './graphql'

export const schema = makeSchema({
  types, // to construct GraphQL schema

  outputs: {
    // where nexus should write the generated TypeScript definition types
    typegen: join(__dirname, '..', 'nexus-typegen.ts'),
    // where nexus should write the SDL version of GraphQL schema
    schema: join(__dirname, '..', 'schema.graphql'),
  },

  // Set context type
  contextType: {
    // path to the module where the context type is exported
    module: join(__dirname, './context.ts'),
    // name of the export in that module
    export: 'ContextModule',
  },
})
