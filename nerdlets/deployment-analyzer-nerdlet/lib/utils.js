import { NerdGraphQuery } from 'nr1';
import gql from 'graphql-tag';

export const accountsQuery = `{
    actor {
      accounts {
        id
        name
      }
    }
  }`

export const deploymentsQuery = `{
    actor {
      entitySearch(queryBuilder: {domain: APM, reporting: true}) {
        count
        query
        results {
          entities {
            ... on ApmApplicationEntityOutline {
              name
              language
              guid
              alertSeverity
              applicationId
              deployments {
                user
                timestamp
                revision
                description
                changelog
              }
              runningAgentVersions {
                maxVersion
                minVersion
              }
              settings {
                apdexTarget
              }
              tags {
                key
                values
              }
              apmSummary {
                apdexScore
                errorRate
                hostCount
                instanceCount
                nonWebResponseTimeAverage
                nonWebThroughput
                responseTimeAverage
                throughput
                webResponseTimeAverage
                webThroughput
              }
              account {
                name
                id
              }
            }
          }
        }
      }
    }
  }`

export const nrdbQuery = async (accountId, query, timeout) => {
    let q = gqlNrqlQuery(accountId, query, timeout)
    let result = await NerdGraphQuery.query({query: q})
    let nrqlResult = (((((result || {}).data || {}).actor || {}).account || {}).nrql || {}).results || []
    return nrqlResult
}

export const gqlNrqlQuery = (accountId, query, timeout) => {
    return gql`{
        actor {
            account(id: ${accountId}) {
                nrql(query: "${query}", timeout: ${timeout || 30000}) {
                results
                }
            }
        }
    }`
}

export const apmEntityGuidsQuery = (cursor) => {
  return `{
    actor {
      entitySearch(queryBuilder: {domain: APM, reporting: true}) {
        count
        query
        results${cursor ? `(cursor: "${cursor}")` : ""} {
          nextCursor
          entities {
            guid
          }
        }
      }
    }
  }`
}

export const entityBatchQuery = (guids) => {
  return `{
    actor {
      entities(guids: [${guids}]) {
        ... on ApmApplicationEntity {
          name
          language
          guid
          alertSeverity
          applicationId
          deployments {
            user
            timestamp
            revision
            description
            changelog
          }
          runningAgentVersions {
            maxVersion
            minVersion
          }
          settings {
            apdexTarget
          }
          tags {
            key
            values
          }
          apmSummary {
            apdexScore
            errorRate
            hostCount
            instanceCount
            nonWebResponseTimeAverage
            nonWebThroughput
            responseTimeAverage
            throughput
            webResponseTimeAverage
            webThroughput
          }
          account {
            name
            id
          }
        }
      }
    }
  }`  
}

export const nerdGraphQuery = async (query) => {
    return (await NerdGraphQuery.query({query: gql`${query}`})).data
}

export const isString = (value) => {
    return typeof value === 'string' || value instanceof String;
}

export const isNumber = (value) =>{
    return typeof value === 'number' && isFinite(value);
}

export const isArray = (value) => {
    return value && typeof value === 'object' && value.constructor === Array;
}
    
export const isObject = (value) => {
    return value && typeof value === 'object' && value.constructor === Object;
}

export const checkType = (value) => {
    if(isString(value)) return "string"
    if(isNumber(value)) return "number"
    if(isArray(value))  return "array"
    if(isObject(value)) return "object"
    return null
}

export const sortObject = (obj) => {
    return Object.keys(obj)
      .sort().reduce((a, v) => {
      a[v] = obj[v];
      return a; }, {});
}