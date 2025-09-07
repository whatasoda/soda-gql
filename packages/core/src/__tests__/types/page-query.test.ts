import { describe, expect, it } from 'bun:test'
import type { PageQuery, QuerySlice } from '../../types/page-query'

describe('PageQuery type', () => {
  it('should have correct type structure for queries', () => {
    type UserData = { user: { id: string; name: string } }
    type PostsData = { posts: Array<{ id: string; title: string }> }
    type CombinedData = UserData & PostsData
    type CombinedArgs = { userId: string; limit: number }

    const pageQuery: PageQuery<CombinedData, CombinedArgs> = {
      _data: {
        user: { id: '', name: '' },
        posts: [],
      },
      _variables: { userId: '', limit: 10 },
      name: 'UserWithPosts',
      type: 'query',
      slices: [],
      document: 'query UserWithPosts($userId: ID!, $limit: Int!) { ... }',
      variables: { userId: '123', limit: 10 },
    }

    expect(pageQuery.name).toBe('UserWithPosts')
    expect(pageQuery.type).toBe('query')
    expect(pageQuery.document).toContain('query UserWithPosts')
    expect(pageQuery.variables.userId).toBe('123')
  })

  it('should support multiple query slices', () => {
    const userSlice: QuerySlice<{ user: any }, { id: string }> = {
      _data: { user: {} },
      _args: { id: '' },
      sliceKey: 'user',
      name: 'user',
      selections: (_query, _args) => ({ user: {} }),
      transform: (data) => data,
    }

    const postsSlice: QuerySlice<{ posts: any[] }, { userId: string }> = {
      _data: { posts: [] },
      _args: { userId: '' },
      sliceKey: 'posts',
      name: 'posts',
      selections: (_query, _args) => ({ posts: [] }),
      transform: (data) => data,
    }

    const pageQuery: PageQuery<any, any> = {
      _data: {},
      _variables: {},
      name: 'UserPage',
      type: 'query',
      slices: [userSlice, postsSlice],
      document: '',
      variables: {},
    }

    expect(pageQuery.slices).toHaveLength(2)
    expect(pageQuery.slices[0]).toBe(userSlice)
    expect(pageQuery.slices[1]).toBe(postsSlice)
  })

  it('should support mutations', () => {
    type CreateUserData = { createUser: { id: string; name: string } }
    type CreateUserArgs = { input: { name: string; email: string } }

    const pageQuery: PageQuery<CreateUserData, CreateUserArgs> = {
      _data: { createUser: { id: '', name: '' } },
      _variables: { input: { name: '', email: '' } },
      name: 'CreateUser',
      type: 'mutation',
      slices: [],
      document: 'mutation CreateUser($input: CreateUserInput!) { ... }',
      variables: { input: { name: 'John', email: 'john@example.com' } },
    }

    expect(pageQuery.type).toBe('mutation')
    expect(pageQuery.document).toContain('mutation CreateUser')
  })

  it('should support subscriptions', () => {
    type MessageData = { messageAdded: { id: string; content: string } }
    type MessageArgs = { channel: string }

    const pageQuery: PageQuery<MessageData, MessageArgs> = {
      _data: { messageAdded: { id: '', content: '' } },
      _variables: { channel: '' },
      name: 'MessageSubscription',
      type: 'subscription',
      slices: [],
      document: 'subscription MessageSubscription($channel: String!) { ... }',
      variables: { channel: 'general' },
    }

    expect(pageQuery.type).toBe('subscription')
    expect(pageQuery.document).toContain('subscription MessageSubscription')
  })

  it('should support empty variables', () => {
    type AllUsersData = { users: Array<{ id: string; name: string }> }

    const pageQuery: PageQuery<AllUsersData, {}> = {
      _data: { users: [] },
      _variables: {},
      name: 'AllUsers',
      type: 'query',
      slices: [],
      document: 'query AllUsers { users { id name } }',
      variables: {},
    }

    expect(pageQuery.variables).toEqual({})
    expect(pageQuery.document).not.toContain('$')
  })

  it('should support transform function on page level', () => {
    type RawData = {
      user: { id: string; firstName: string; lastName: string }
      posts: Array<{ id: string; title: string; createdAt: string }>
    }

    type TransformedData = {
      user: { id: string; fullName: string }
      posts: Array<{ id: string; title: string; date: Date }>
    }

    const pageQuery: PageQuery<RawData, {}> = {
      _data: {
        user: { id: '', firstName: '', lastName: '' },
        posts: [],
      },
      _variables: {},
      name: 'UserProfile',
      type: 'query',
      slices: [],
      document: '',
      variables: {},
      transform: (data: RawData): TransformedData => ({
        user: {
          id: data.user.id,
          fullName: `${data.user.firstName} ${data.user.lastName}`,
        },
        posts: data.posts.map((post) => ({
          id: post.id,
          title: post.title,
          date: new Date(post.createdAt),
        })),
      }),
    }

    expect(typeof pageQuery.transform).toBe('function')
  })
})
