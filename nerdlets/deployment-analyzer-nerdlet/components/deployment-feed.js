import React from 'react';
import PropTypes from 'prop-types';

import { Header, Button, Popup, Icon } from 'semantic-ui-react';
import { navigation } from 'nr1';
import { List } from 'react-virtualized';

const cardHeight = 110;

export default class DeploymentFeed extends React.PureComponent {
  static propTypes = {
    filters: PropTypes.object,
    setParentState: PropTypes.func,
    deploymentsToAnalyze: PropTypes.object,
    deployments: PropTypes.object,
    height: PropTypes.number,
    width: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.rowRenderer = this.rowRenderer.bind(this);
    this.updateFilter = this.updateFilter.bind(this);
    this.addDeployment = this.addDeployment.bind(this);
  }

  componentDidUpdate() {
    if (this.list) {
      this.list.forceUpdateGrid();
    }
  }

  updateFilter(key, val) {
    const { filters, setParentState } = this.props;
    filters[`${key}:${val}`] = `${key}:${val}`;
    setParentState({ filters }, 'groupDeployments');
  }

  addDeployment(deployment) {
    const { deploymentsToAnalyze, setParentState } = this.props;
    const appName = deployment['Application Name'];
    const accName = deployment['Account Name'];
    const key = `${deployment.timestamp}_${appName}_${accName}`;
    deploymentsToAnalyze[key] = deployment;
    setParentState({ deploymentsToAnalyze });
  }

  rowRenderer({
    key, // Unique key within array of rows
    index, // Index of row within collection
    // eslint-disable-next-line no-unused-vars
    isScrolling, // The List is currently being scrolled
    // eslint-disable-next-line no-unused-vars
    isVisible, // This row is visible within the List (eg it is not an overscanned row)
    style, // Style object to be applied to row (to position it)
  }) {
    const deployment = this.props.deployments[index];
    const deployDate = new Date(deployment.timestamp).toLocaleString();
    const appName = deployment['Application Name'];
    const accName = deployment['Account Name'];
    const excludeKeys = [
      'revision',
      'Application Name',
      'Account Name',
      'description',
      'account.id',
      'guid',
    ];
    let statusColor = 'green';
    let statusMessage = 'Service is not alerting';
    if (deployment['apmSummary.apdexScore'] < 1) {
      statusColor = 'orange';
      statusMessage = `Apdex ${deployment['apmSummary.apdexScore']}`;
    }
    if (deployment['apmSummary.errorRate'] > 0) {
      statusColor = 'red';
      statusMessage = `Error rate ${deployment['apmSummary.errorRate']}`;
    }

    return (
      <div key={`${index}_${key}_${accName}_${appName}`} style={style}>
        <div
          className="deployment-card"
          style={{
            height: cardHeight,
            padding: '10px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div style={{}}>
            <Header as="h5">
              <Popup
                content={statusMessage}
                trigger={
                  <span>
                    <Icon
                      color={statusColor}
                      name={statusColor !== 'green' ? 'warning' : 'check'}
                      circular
                    />{' '}
                    {deployDate}{' '}
                  </span>
                }
              />
              <Header.Subheader>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigation.openStackedEntity(deployment.guid)}
                >
                  {appName}
                </span>
              </Header.Subheader>
              <Header.Subheader>{accName}</Header.Subheader>
              <Header.Subheader>{deployment.description}</Header.Subheader>
              <Header.Subheader>{deployment.revision}</Header.Subheader>
            </Header>
          </div>
          <div>
            <div style={{ textAlign: 'right' }}>
              <Popup
                basic
                mouseEnterDelay={500}
                hoverable
                trigger={
                  <Button
                    icon="tags"
                    basic
                    style={{ width: '110px' }}
                    content="Filter Tags"
                  />
                }
                style={{ padding: 0, margin: 0, width: 10, textAlign: 'left' }}
              >
                {Object.keys(deployment).map((dKey, i) => {
                  if (!excludeKeys.includes(dKey) && deployment[dKey]) {
                    return (
                      <Button
                        key={`${dKey}_${i}`}
                        basic
                        icon="add"
                        labelPosition="left"
                        content={`${dKey}: ${deployment[dKey]}`}
                        onClick={() =>
                          this.updateFilter(dKey, deployment[dKey])
                        }
                        style={{
                          display: 'inline-block',
                          width: 350,
                          marginRight: 0,
                          borderRadius: 0,
                          textAlign: 'left',
                          fontSize: '10px',
                          padding: '2px',
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </Popup>
              <br />
              <br />
              <Button
                icon="chart line"
                basic
                size="mini"
                content="Analyze"
                style={{ width: '110px' }}
                onClick={() => this.addDeployment(deployment)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  bindListRef = (ref) => {
    this.list = ref;
  };

  // list doesn't reupdate if row length is the same without the bindListRef
  // https://github.com/bvaughn/react-virtualized/issues/1262
  render() {
    const { deployments, height, width } = this.props;
    return (
      <div style={{ backgroundColor: '#FFF' }}>
        <List
          ref={this.bindListRef}
          width={width}
          height={height}
          rowCount={deployments.length}
          rowHeight={cardHeight}
          rowRenderer={this.rowRenderer}
          style={{ borderRight: '1px solid #b9bdbdaf' }}
        />
      </div>
    );
  }
}
