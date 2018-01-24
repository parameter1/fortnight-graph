# Fortnight (GraphQL) API
Server backend for the Fortnight project, including the primary Graph API, as well as placement and tracking endpoints.

## Requirements
This project requires [NodeJS](https://nodejs.org) >7.10, as `async/await` functions are utilized, though it is recommended to use the latest LTS (currently 8.9.x). The [Yarn](https://yarnpkg.com) package manager is also required, and is used instead of `npm`.

## Runnning
1. Clone repository
2. Set the appropriate development environment variables (see [Environment Variables](#environment-variables) below)
2. In the project root, run `yarn install`
3. Run the dev server `yarn run start:dev`
4. The server is now accessible on `localhost:8100` (or whatever port you configure)

## Environment Variables
Environment variables are *not* under version control, per [Part 3 of the 12 Factors](https://12factor.net/config). As such, the [dotenv](https://www.npmjs.com/package/dotenv) package is used to manage your variables locally.
1. Create a `.env` file in the project root (at the same level as the `package.json` file)
2. Set (or change) values for the following variables:
```ini
NODE_ENV=development
PORT=8100

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
MONGO_DSN=
REDIS_DSN=
```

## API
### Graph
The API utilizes [GraphQL](http://graphql.org/learn/) and, as such, there is one endpoint for accessing the API: `/graph`. The GraphQL implementation is setup to handle JSON `POST` requests (or `GET` requests with the `?query=` parameter) for both queries and mutations.
#### Queries and Mutatations
```graphql
type Query {
  ping: String!
  currentUser: User
  checkSession(input: SessionTokenInput!): Authentication
  signImageUpload(input: ImageUploadInput!): SignedImageLocation!
  advertiser(input: ModelIdInput!): Advertiser!
  allAdvertisers(pagination: PaginationInput): [Advertiser]
}

type Mutation {
  createUser(input: CreateUserInput!): User
  createAdvertiser(input: CreateAdvertiserInput!): Advertiser
  loginUser(input: LoginInput!): Authentication
  deleteSession: String
}
```
See the `graph/index.graphql` file for complete details, or use a GraphQL compatible client (such as [Insomnia](https://insomnia.rest/)) for automatic schema detection and query autocomplete capabilities.

### Placement Delivery
Requests for an ad placement, or placements, can be made to `GET /placement/{pid}.html` (or `.json` for JSON responses). This will trigger the Campaign-Serve-Algorithm (or CSA) and provide the best matching campaigns for the requested Placement ID (`pid`) and request options. If no campaigns can be found for the specific request, an empty response will be returned.

The available request parameters (as query string values) are as follows, and are _all optional_:

**`limit`**
Specifies the number of campaigns that should be returned.  The default value is `1` and cannot exceed `10`. The CSA will do its best to return the number requested, but is not guaranteed, based on inventory conditions. For example, `limit=2` or `limit=5`.

**`cv`**
The custom variables to send with the request. Can be sent as either object-notated key/values, or as a URL encoded query string. For example, as an object: `cv[foo]=bar&cv[key]=value`, or as URL encoded string: `cv=foo%3Dbar%26key%3Dvalue`

**`mv`**
The custom merge values to be used inside the placement's template. Will only be applied if the variable exists within the template. Can be sent as either object-notated key/values, or as a URL encoded query string. For example, as an object: `mv[foo]=bar&mv[key]=value`, or as URL encoded string: `mv=foo%3Dbar%26key%3Dvalue`

## Additional Resources
This application uses many popular, open source NodeJS packages. Please visit the following links if you'd like to learn more.
- [Express](https://expressjs.com/) - "Fast, unopinionated, minimalist web framework for Node.js"
- [Apollo Graph Server](https://www.apollographql.com/servers) - "Easily build a GraphQL API that connects to one or more
REST APIs, microservices, or databases."
- [Mongoose](http://mongoosejs.com/docs/guide.html) - "elegant mongodb object modeling for node.js"
- [Passport](http://www.passportjs.org/) - "Simple, unobtrusive authentication for Node.js"
- [Bluebird](http://bluebirdjs.com/docs/getting-started.html) - "A full featured promise library with unmatched performance."

