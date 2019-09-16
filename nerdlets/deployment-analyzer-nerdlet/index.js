import React from 'react';
import { NerdletStateContext, PlatformStateContext, AutoSizer } from 'nr1';
import DeploymentAnalyzer from './deployment-analyzer'
export default class Root extends React.Component {

    render() {
        return (
            <PlatformStateContext.Consumer>
            {(launcherUrlState) => (
              <NerdletStateContext.Consumer>
                {(nerdletUrlState) => (
                  <AutoSizer>
                    {({width, height}) => (
                      <DeploymentAnalyzer
                        launcherUrlState={launcherUrlState}
                        nerdletUrlState={nerdletUrlState}
                        width={width}
                        height={height}
                      />
                    )}
                  </AutoSizer>
                )}
              </NerdletStateContext.Consumer>
            )}
          </PlatformStateContext.Consumer>
        )
    }
}
