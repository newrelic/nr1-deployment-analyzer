import React from 'react';
import PropTypes from 'prop-types';
import { Menu, Grid, GridColumn, Dimmer, Loader } from 'semantic-ui-react';
import {
  nerdGraphQuery,
  checkType,
  sortObject,
  apmEntityGuidsQuery,
  entityBatchQuery,
} from './lib/utils';
import MenuBar from './components/menu-bar';
import DeploymentFeed from './components/deployment-feed';
import FiltersContainer from './components/filters-container';
import DeploymentsContainer from './components/deployments-container';
import _ from 'lodash';
// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

export default class DeploymentAnalyzer extends React.PureComponent {
  static propTypes = {
    launcherUrlState: PropTypes.object,
    height: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.state = {
      entities: [],
      groupBy: {
        label: 'Application Name',
        value: 'Application Name',
        type: 'string',
      },
      groupSelected: '',
      groupSelectedMenu: '',
      deployments: [],
      deploymentsGrouped: {},
      deploymentsToAnalyze: {},
      metrics: {
        deploysToday: 0,
        total: 0,
        appsWithErrors: [],
        appsAlerting: [],
        appsWithApdexBelow1: [],
      },
      timeRange: null,
      filters: {},
      loading: false,
    };
    this.setParentState = this.setParentState.bind(this);
    this.groupDeployments = this.groupDeployments.bind(this);
    this.updateFilter = this.updateFilter.bind(this);
    this.fetchDeploymentData = this.fetchDeploymentData.bind(this);
  }

  async componentDidMount() {
    this.setState({ loading: true });
    this.loadData();
  }

  async componentDidUpdate() {
    const newTimeRange = this.props.launcherUrlState.timeRange;

    if (!_.isEqual(this.state.timeRange, newTimeRange)) {
      this.loadData();
    }
  }

  loadData() {
    const { launcherUrlState } = this.props;
    const { startTime, endTime } = this.determineTimeWindow(
      launcherUrlState.timeRange
    );
    this.setState({
      loading: true,
      timeRange: launcherUrlState.timeRange,
    });
    this.fetchDeploymentData(true, null, startTime, endTime);
  }

  async setParentState(data, trigger) {
    this.setState(data, () => {
      if (
        !trigger &&
        typeof data === 'object' &&
        data !== null &&
        data !== {}
      ) {
        trigger = Object.keys(data)[0];
      }
      switch (trigger) {
        case 'deploymentsToAnalyze':
        case 'groupDeployments':
          this.groupDeployments(
            this.state.deployments,
            this.state.groupBy,
            this.state.filters
          );
          break;
      }
    });
  }

  updateFilter = (data) => {
    const { filters, deployments, groupBy } = this.state;
    filters[data.label] = data.value;
    this.setState({ filters });
    this.groupDeployments(deployments, groupBy, filters);
  };

  determineTimeWindow(timeRange) {
    const { begin_time, end_time, duration } = timeRange;
    if (duration) {
      const endTime = new Date().getTime();
      const startTime = endTime - duration;
      return { startTime, endTime, duration };
    } else if (begin_time && end_time) {
      const startTime = begin_time;
      const endTime = end_time;
      return { startTime, endTime, duration };
    }
    return null;
  }

  handleGroupSelect = (name, group) => {
    this.setState({ groupSelectedMenu: name, groupSelected: group });
  };

  async fetchDeploymentData(startNew, cursor, startTime, endTime) {
    if (startNew) {
      this.setState({
        entities: [],
        deployments: [],
        deploymentsGrouped: {},
        deploymentsToAnalyze: {},
      });
    }

    const nerdGraphResult = await nerdGraphQuery(apmEntityGuidsQuery(cursor));
    const entitySearchResults =
      (((nerdGraphResult || {}).actor || {}).entitySearch || {}).results || {};
    const foundGuids = ((entitySearchResults || {}).entities || []).map(
      (result) => result.guid
    );
    if (entitySearchResults) {
      const entityChunks = chunk(foundGuids, 25);
      const entityPromises = entityChunks.map((chunk) => {
        const guids = `"${chunk.join(`","`)}"`;
        return nerdGraphQuery(entityBatchQuery(guids, startTime, endTime));
      });

      await Promise.all(entityPromises).then((values) => {
        let { entities } = this.state;
        values.forEach(async (value) => {
          const entitiesResult = ((value || {}).actor || {}).entities || [];
          entities = [...entities, ...entitiesResult];
          this.setState({ entities });
        });
      });

      if (entitySearchResults.nextCursor) {
        // console.debug(
        //   'collecting next entitySearch batch guid:',
        //   entitySearchResults.nextCursor
        // );
        this.fetchDeploymentData(
          false,
          entitySearchResults.nextCursor,
          startTime,
          endTime
        );
      } else {
        // console.debug('complete', this.state.entities.length);
        const { deployments, sortByOptions, metrics } = this.sortDeployments(
          this.state.entities
        );
        this.groupDeployments(
          deployments,
          this.state.groupBy,
          this.state.filters
        );
        this.setState({
          loading: false,
          deployments,
          sortByOptions,
          metrics,
        });
      }
    }
  }

  sortDeployments(entities) {
    const currentDate = new Date().toLocaleDateString();
    let deployments = [];
    let sortByOptions = {};
    let filterOptions = {};
    const metrics = {
      deploysToday: 0,
      total: 0,
      appsWithErrors: [],
      appsAlerting: [],
      appsWithApdexBelow1: [],
    };
    entities.forEach((entity) => {
      // console.log(entity?.deploymentSearch || []);
      (entity?.deploymentSearch?.results || []).forEach((deployment) => {
        // decorate deployments with entity meta
        Object.keys(entity).forEach((entityKey) => {
          const entityKeyValue = entity[entityKey];
          const dataType = checkType(entityKeyValue);
          switch (dataType) {
            case 'string':
              deployment[entityKey] = entityKeyValue;
              break;
            case 'number':
              deployment[entityKey] = entityKeyValue;
              break;
            case 'object':
              Object.keys(entityKeyValue).forEach((key) => {
                deployment[`${entityKey}.${key}`] = entityKeyValue[key];
              });
              break;
            case 'array':
              if (entityKey === 'tags') {
                entityKeyValue.forEach((tag) => {
                  deployment[`tag.${tag.key}`] =
                    tag.values.length > 0 ? tag.values[0] : '';
                });
              }
              break;
            default:
            // console.log('no idea', dataType, entityKey);
          }
        });

        deployment['Account Name'] = deployment['account.name'];
        delete deployment['account.name'];
        deployment['Application Name'] = deployment.name;
        delete deployment.name;

        const deploymentDate = new Date(
          deployment.timestamp
        ).toLocaleDateString();
        if (deploymentDate === currentDate) {
          metrics.deploysToday = metrics.deploysToday + 1;
        }
        deployment.Date = deploymentDate;

        // delete typenames and add keys to sort options
        Object.keys(deployment).forEach((deploymentKey) => {
          if (deploymentKey.includes('__typename')) {
            delete deployment[deploymentKey];
          } else {
            const dataType = checkType(deployment[deploymentKey]);
            if (!sortByOptions[deploymentKey] && dataType === 'string')
              sortByOptions[deploymentKey] = dataType;
            if (!filterOptions[deploymentKey])
              filterOptions[deploymentKey] = dataType;
          }
        });

        if (
          deployment['apmSummary.apdexScore'] < 1 &&
          !metrics.appsWithApdexBelow1.includes(deployment['Application Name'])
        )
          metrics.appsWithApdexBelow1.push(deployment['Application Name']);
        if (
          deployment['apmSummary.errorRate'] > 0 &&
          !metrics.appsWithErrors.includes(deployment['Application Name'])
        )
          metrics.appsWithErrors.push(deployment['Application Name']);
        if (
          deployment.alertSeverity !== 'UNCONFIGURED' &&
          deployment.alertSeverity !== 'NOT_CONFIGURED' &&
          deployment.alertSeverity !== 'NOT_ALERTING' &&
          !metrics.appsAlerting.includes(deployment['Application Name'])
        )
          metrics.appsAlerting.push(deployment['Application Name']);

        deployments.push(deployment);
      });
    });

    metrics.total = deployments.length;

    // sort keys alphabetically
    sortByOptions = sortObject(sortByOptions);
    filterOptions = sortObject(filterOptions);
    deployments = _.orderBy(deployments, ['timestamp'], ['desc']); // sort newest deployments first
    return { deployments, sortByOptions, filterOptions, metrics };
  }

  groupDeployments(deployments, groupBy, filters) {
    let tempDeployments = [...deployments];
    let filterApdex = false;
    let filterError = false;

    Object.keys(filters).forEach((filterValue) => {
      const split = filterValue.split(':');
      switch (filterValue) {
        case 'Error Rate > 0':
          filterError = true;
          break;
        case 'Apdex Score < 1':
          filterApdex = true;
          break;
        case 'Alerting':
          tempDeployments = tempDeployments.filter(
            (deployment) =>
              deployment.alertSeverity &&
              deployment.alertSeverity !== 'UNCONFIGURED' &&
              deployment.alertSeverity !== 'NOT_CONFIGURED' &&
              deployment.alertSeverity !== 'NOT_ALERTING'
          );
          break;
        default:
          if (isNaN(split[1])) {
            tempDeployments = tempDeployments.filter(
              (deployment) =>
                deployment[split[0]] && deployment[split[0]] === split[1]
            );
          } else {
            tempDeployments = tempDeployments.filter(
              (deployment) =>
                deployment[split[0]] &&
                deployment[split[0]] >= parseFloat(split[1])
            );
          }
      }
    });

    // do an OR if filtering apdex and error
    if (filterApdex && filterError) {
      tempDeployments = tempDeployments.filter(
        (deployment) =>
          (deployment['apmSummary.apdexScore'] &&
            deployment['apmSummary.apdexScore'] < 1) ||
          (deployment['apmSummary.errorRate'] &&
            deployment['apmSummary.errorRate'] > 0)
      );
    } else if (filterApdex && !filterError) {
      tempDeployments = tempDeployments.filter(
        (deployment) =>
          deployment['apmSummary.apdexScore'] &&
          deployment['apmSummary.apdexScore'] < 1
      );
    } else if (filterError && !filterApdex) {
      tempDeployments = tempDeployments.filter(
        (deployment) =>
          deployment['apmSummary.errorRate'] &&
          deployment['apmSummary.errorRate'] > 0
      );
    }

    const deploymentsGrouped = _.groupBy(tempDeployments, groupBy.value);
    this.setState({ deploymentsGrouped });
    this.forceUpdate();
  }

  render() {
    const {
      groupSelectedMenu,
      groupSelected,
      sortByOptions,
      filters,
      groupBy,
      deploymentsGrouped,
      deploymentsToAnalyze,
      loading,
      metrics,
    } = this.state;
    return (
      <>
        <Grid>
          <Grid.Row style={{ paddingBottom: 0 }}>
            <GridColumn width={16}>
              <MenuBar
                metrics={metrics}
                filters={filters}
                groupBy={groupBy}
                sortByOptions={sortByOptions}
                updateFilter={this.updateFilter}
                setParentState={this.setParentState}
              />
              <FiltersContainer
                filters={filters}
                setParentState={this.setParentState}
                count={Object.keys(filters).length} // need else re-render won't occur with objectKey loop
              />
            </GridColumn>
          </Grid.Row>

          <Grid.Row style={{ paddingTop: 0, borderTop: '1px solid #b9bdbdaf' }}>
            <Dimmer active={loading}>
              <Loader size="huge">
                Please be patient while we collect your deployments...
              </Loader>
            </Dimmer>
            <Grid.Column
              width={3}
              className="column-right-border"
              style={{
                paddingRight: 0,
                backgroundColor: '#fff',
                height: this.props.height - 120,
              }}
            >
              <Menu
                pointing
                secondary
                vertical
                style={{
                  maxHeight: this.props.height - 110,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  width: '100%',
                }}
              >
                {Object.keys(deploymentsGrouped).map((group, i) => {
                  const name = `${group} (${deploymentsGrouped[group].length})`;
                  return (
                    <Menu.Item
                      key={`${name}_${i}`}
                      name={name}
                      active={groupSelectedMenu === name}
                      onClick={(e, data) =>
                        this.handleGroupSelect(data.name, group)
                      }
                    >
                      {name}
                    </Menu.Item>
                  );
                })}
              </Menu>
            </Grid.Column>
            <Grid.Column
              width={4}
              style={{ maxHeight: this.props.height - 75, padding: '0px' }}
            >
              {deploymentsGrouped[groupSelected] ? (
                <DeploymentFeed
                  setParentState={this.setParentState}
                  filters={filters}
                  groupSelected={groupSelected}
                  deployments={deploymentsGrouped[groupSelected]}
                  deploymentsToAnalyze={deploymentsToAnalyze}
                />
              ) : null}
            </Grid.Column>
            <Grid.Column width={9} style={{ padding: '0px', height: '100%' }}>
              <DeploymentsContainer
                deploymentsToAnalyze={deploymentsToAnalyze}
                metrics={metrics}
                groupedDeployments={deploymentsGrouped[groupSelected] || {}}
                setParentState={this.setParentState}
              />
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </>
    );
  }
}
