import React from 'react';
import { PlatformStateContext, AutoSizer } from 'nr1';
import DeploymentAnalyzer from './deployment-analyzer';

export default class Root extends React.PureComponent {
  render() {
    return (
      <PlatformStateContext.Consumer>
        {(launcherUrlState) => (
          <AutoSizer>
            {({ height }) => (
              <DeploymentAnalyzer
                launcherUrlState={launcherUrlState}
                height={height}
              />
            )}
          </AutoSizer>
        )}
      </PlatformStateContext.Consumer>
    );
  }
}
