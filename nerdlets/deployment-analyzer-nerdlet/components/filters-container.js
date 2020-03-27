import React from 'react';
import { Icon } from 'semantic-ui-react';

function Filter({ attribute, value, removeFilter }) {
  return (
    <div className="filter">
      <span onClick={removeFilter}>
        {value} <Icon link name="close" />
      </span>
    </div>
  );
}

export default class FiltersContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.removeFilter = this.removeFilter.bind(this);
  }

  removeFilter = (label) => {
    const { filters, setParentState } = this.props;
    delete filters[label];
    setParentState({ filters }, 'groupDeployments');
  };

  render() {
    const { filters } = this.props;
    return (
      <div className="filters-container" style={{ textAlign: 'left' }}>
        <h3 className="filters-header">Filters ({this.props.count}):</h3>
        {Object.keys(filters).map((label) => {
          return (
            <Filter
              key={`${label}/${filters[label]}`}
              attribute={label}
              value={label}
              removeFilter={() => this.removeFilter(label)}
            />
          );
        })}
      </div>
    );
  }
}
