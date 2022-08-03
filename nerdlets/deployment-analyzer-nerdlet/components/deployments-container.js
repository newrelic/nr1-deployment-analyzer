import React from 'react';
import PropTypes from 'prop-types';

import {
  AutoSizer,
  ChartGroup,
  LineChart,
  NrqlQuery,
  BillboardChart,
  navigation,
} from 'nr1';
import {
  Icon,
  Label,
  Header,
  Divider,
  Popup,
  Button,
  List,
} from 'semantic-ui-react';

function openChartBuilder(query, account) {
  const nerdlet = {
    id: 'data-exploration.nrql-editor',
    urlState: {
      initialActiveInterface: 'nrqlEditor',
      initialChartType: 'table',
      initialAccountId: account,
      initialNrqlValue: query,
      isViewingQuery: true,
    },
  };
  navigation.openOverlay(nerdlet);
}

function createMarker(timestamp) {
  return {
    metadata: {
      id: 'axis-marker-error',
      color: '#000000',
      viz: 'event',
      axisMarkersType: 'alert',
      name: 'Deployment',
    },
    data: [
      {
        id: timestamp,
        x0: timestamp,
        x1: timestamp,
      },
    ],
  };
}

export default class DeploymentsContainer extends React.PureComponent {
  static propTypes = {
    setParentState: PropTypes.func,
    metrics: PropTypes.object,
    deploymentsToAnalyze: PropTypes.object,
    groupedDeployments: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.object,
    ]),
  };

  constructor(props) {
    super(props);
    this.removeDeployment = this.removeDeployment.bind(this);
  }

  removeDeployment(key) {
    const { deploymentsToAnalyze, setParentState } = this.props;
    delete deploymentsToAnalyze[key];
    setParentState({ deploymentsToAnalyze });
  }

  render() {
    const { metrics, deploymentsToAnalyze, groupedDeployments } = this.props;

    if (metrics && metrics.total === 0) {
      return (
        <>
          <br />
          <Header as="h3">No Deployments Found!</Header>
          <Header as="h5">Suggestions</Header>
          <List bulleted>
            <List.Item>Check the time picker</List.Item>
            <List.Item>Ensure you are using APM Deployment Markers</List.Item>
            <List.Item>
              Confirm the Nerdpack has been deployed correctly
              <List.List>
                <List.Item>Check the target account and profile</List.Item>
                <List.Item>
                  Check if the UUID has been updated for your targeted account
                </List.Item>
              </List.List>
            </List.Item>
          </List>
        </>
      );
    } else if (metrics.total > 0 && Object.keys(groupedDeployments) === 0) {
      return (
        <div style={{ paddingLeft: '10px' }}>
          <br />
          <Header as="h4">
            Select an option on the left to view the deployments.
          </Header>
          <Header as="h4">
            Consider adjusting the grouping and filter options in the menu bar.
          </Header>
        </div>
      );
    } else if (metrics.total > 0 && Object.keys(deploymentsToAnalyze) === 0) {
      return (
        <div style={{ paddingLeft: '10px' }}>
          <br />
          <Header as="h4">
            Click analyze on the corresponding deployments to the left for
            further detail.
          </Header>
        </div>
      );
    }

    return (
      <AutoSizer>
        {({ height }) => {
          return (
            <div
              style={{
                height: height,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingTop: '15px',
                paddingRight: '25px',
                paddingLeft: '5px',
                backgroundColor: '#FFF',
              }}
            >
              <ChartGroup>
                {Object.keys(deploymentsToAnalyze).map((key, i) => {
                  const deployment = deploymentsToAnalyze[key];
                  const deployDate = new Date(
                    deployment.timestamp
                  ).toLocaleString();
                  const appName = deployment['Application Name'];
                  const accName = deployment['Account Name'];
                  const startBeforeMs = 300000; // 5 minutes
                  const sinceTime = deployment.timestamp - startBeforeMs;
                  const untilTime = deployment.timestamp + startBeforeMs;
                  const appClause = `WHERE appId = ${deployment.applicationId} OR applicationId = ${deployment.applicationId}`;
                  const timeClause = `SINCE ${sinceTime} UNTIL ${untilTime}`;
                  // let timezone =  `WITH TIMEZONE '${Intl.DateTimeFormat().resolvedOptions().timeZone}'`
                  const throughputQuery = `SELECT count(*) as 'Requests' FROM Transaction, TransactionError`;
                  const responseQuery = `SELECT average(duration) as 'Response' FROM Transaction`;
                  const chartQuery = `SELECT * FROM Transaction, TransactionError ${appClause} SINCE ${sinceTime} UNTIL ${untilTime} LIMIT MAX`;
                  const errorQuery = `SELECT count(*) as 'Errors' FROM Transaction, TransactionError WHERE error IS TRUE OR (httpResponseCode NOT LIKE '2%%' AND httpResponseCode NOT LIKE '3%%' AND httpResponseCode IS NOT NULL) OR error.message IS NOT NULL`;
                  const topChartStyle = {
                    width: '125px',
                    height: '50px',
                    display: 'inline-block',
                    paddingRight: '15px',
                  };
                  const chartStyle = {
                    width: '300px',
                    height: '150px',
                    display: 'inline-block',
                    paddingRight: '15px',
                  };
                  return (
                    <div key={i}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <BillboardChart
                            accountIds={[deployment['account.id']]}
                            query={`${throughputQuery} ${appClause} ${timeClause}`}
                            style={topChartStyle}
                          />
                          <BillboardChart
                            accountIds={[deployment['account.id']]}
                            query={`${responseQuery} ${appClause} ${timeClause}`}
                            style={topChartStyle}
                          />
                          <BillboardChart
                            accountIds={[deployment['account.id']]}
                            query={`${errorQuery} ${appClause} ${timeClause}`}
                            style={topChartStyle}
                          />
                        </div>

                        <div>
                          <Popup
                            basic
                            content="View Events from 5 minutes before till 5 minutes after your deployment"
                            trigger={
                              <Button
                                className="filter-button"
                                icon="chart line"
                                onClick={() =>
                                  openChartBuilder(
                                    chartQuery,
                                    deployment['account.id']
                                  )
                                }
                                content="View Events"
                              />
                            }
                          />
                        </div>

                        <div className="flex-push" />

                        <div>
                          <Header as="h4" style={{ textAlign: 'right' }}>
                            <Label
                              image
                              basic
                              onClick={() => this.removeDeployment(key)}
                              size="large"
                              style={{ border: '0px', paddingRight: '0px' }}
                            >
                              {deployDate}
                              <Icon name="delete" />
                            </Label>
                            {/* {deployDate} <Icon link name='close' size={"mini"} onClick={()=>this.removeDeployment(key)} /> */}
                            <Header.Subheader>
                              <span
                                style={{ cursor: 'pointer' }}
                                onClick={() =>
                                  navigation.openStackedEntity(deployment.guid)
                                }
                              >
                                {appName}
                              </span>{' '}
                              on {accName}
                            </Header.Subheader>
                            <Header.Subheader>
                              {deployment.description} : {deployment.revision}
                            </Header.Subheader>
                          </Header>
                        </div>
                      </div>

                      <Divider
                        style={{ marginTop: '7px', marginBottom: '7px' }}
                      />

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-around',
                        }}
                      >
                        <NrqlQuery
                          accountIds={[deployment['account.id']]}
                          query={`${throughputQuery} ${appClause} TIMESERIES ${timeClause}`}
                        >
                          {({ data }) => {
                            if (data) {
                              data = data.map((nrqlData) => {
                                nrqlData.metadata.timezone_offsets = null;
                                return nrqlData;
                              });
                              const deploymentMarker = createMarker(
                                deployment.timestamp,
                                '#000000'
                              );
                              data = data.concat(deploymentMarker);
                            }
                            return <LineChart data={data} style={chartStyle} />;
                          }}
                        </NrqlQuery>
                        <NrqlQuery
                          accountIds={[deployment['account.id']]}
                          query={`${responseQuery} ${appClause} TIMESERIES ${timeClause}`}
                        >
                          {({ data }) => {
                            if (data) {
                              data = data.map((nrqlData) => {
                                nrqlData.metadata.timezone_offsets = null;
                                return nrqlData;
                              });
                              const deploymentMarker = createMarker(
                                deployment.timestamp,
                                '#000000'
                              );
                              data = data.concat(deploymentMarker);
                            }
                            return <LineChart data={data} style={chartStyle} />;
                          }}
                        </NrqlQuery>
                        <NrqlQuery
                          accountIds={[deployment['account.id']]}
                          query={`${errorQuery} ${appClause} TIMESERIES ${timeClause}`}
                        >
                          {({ data }) => {
                            if (data) {
                              data = data.map((nrqlData) => {
                                nrqlData.metadata.timezone_offsets = null;
                                return nrqlData;
                              });
                              const deploymentMarker = createMarker(
                                deployment.timestamp,
                                '#000000'
                              );
                              data = data.concat(deploymentMarker);
                            }
                            return <LineChart data={data} style={chartStyle} />;
                          }}
                        </NrqlQuery>
                      </div>
                      <Divider />
                    </div>
                  );
                })}
              </ChartGroup>
            </div>
          );
        }}
      </AutoSizer>
    );
  }
}
