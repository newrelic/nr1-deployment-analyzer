import React from 'react';
import { Menu, Header, Grid, GridColumn, Dimmer, Loader } from 'semantic-ui-react';
import { nerdGraphQuery, deploymentsQuery, checkType, sortObject } from './lib/utils'
import { AutoSizer } from 'nr1'; 
import MenuBar from './components/menu-bar'
import DeploymentFeed from './components/deployment-feed'
import FiltersContainer from './components/filters-container'
import DeploymentsContainer from './components/deployments-container';

// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction


export default class DeploymentAnalyzer extends React.Component {

    constructor(props){
        super(props)
        this.state = { 
            accounts: [],
            applications: [],
            sortByOptions: {}, // only string based options
            filterOptions: {}, // any string or numeric options
            groupBy: { label: "Application Name", value: "Application Name", type: "string" },
            groupSelected: "",
            groupSelectedMenu: "",
            deployments: [],
            deploymentsGrouped: {},
            deploymentsFiltered: [],
            deploymentsToAnalyze: {},
            metrics: {
                deploysToday: 0,
                total: 0,
                appsWithErrors: [],
                appsAlerting: [],
                appsWithApdexBelow1: []
            },
            filters: {},
            loading: false
        }
        this.setParentState = this.setParentState.bind(this);
        this.groupDeployments = this.groupDeployments.bind(this);
        this.updateFilter = this.updateFilter.bind(this);
        this.fetchDeploymentData = this.fetchDeploymentData.bind(this);
    }


    async setParentState(data, trigger){
        await this.setState(data)
        switch(trigger){
            case "groupDeployments":
                this.groupDeployments(this.state.deployments, this.state.groupBy, this.state.filters)
            break
        }
    }

    updateFilter = (data) => {
        let { filters, deployments, groupBy } = this.state
        filters[data.label] = data.value
        this.setState({filters})
        this.groupDeployments(deployments, groupBy, filters)
    }

    componentDidMount(){
        this.fetchDeploymentData()
    }

    async fetchDeploymentData(){
        await this.setState({loading: true})
        let { deployments, sortByOptions, filterOptions, metrics } = await this.fetchDeployments()
        this.groupDeployments(deployments, this.state.groupBy, this.state.filters)
        this.setState({ deployments, sortByOptions, filterOptions })
        await this.setState({loading: false, metrics})
        // console.log(deployments, sortByOptions, filterOptions)
    }

    handleGroupSelect = (name, group) => {
        this.setState({ groupSelectedMenu: name, groupSelected: group })
    }

    fetchDeployments(){
        return new Promise(async (resolve)=>{
            let currentDate = new Date().toLocaleDateString()
            let deploymentsQueryResult = await nerdGraphQuery(deploymentsQuery)
            let entities = ((((deploymentsQueryResult || {}).actor || {}).entitySearch || {}).results || {}).entities || []
            let deployments = []
            let sortByOptions = {}
            let filterOptions = {}
            let metrics = {
                deploysToday: 0,
                total: 0,
                appsWithErrors: [],
                appsAlerting: [],
                appsWithApdexBelow1: []
            }
            entities.forEach((entity)=>{
                entity.deployments.forEach((deployment)=>{
                    // decorate deployments with entity meta
                    Object.keys(entity).forEach((entityKey)=>{
                        let entityKeyValue = entity[entityKey]
                        let dataType = checkType(entityKeyValue)
                        switch(dataType){
                            case "string":
                                deployment[entityKey] = entityKeyValue
                                break
                            case "number":
                                deployment[entityKey] = entityKeyValue
                                break
                            case "object":
                                Object.keys(entityKeyValue).forEach((key)=>{
                                    deployment[`${entityKey}.${key}`] = entityKeyValue[key]
                                })
                                break
                            case "array":
                                if(entityKey == "tags"){
                                    entityKeyValue.forEach((tag)=>{
                                        deployment[`tag.${tag.key}`] = tag.values.length > 0 ? tag.values[0] : ""
                                    })
                                }
                                break
                            default:
                                console.log("no idea",dataType, entityKey)
                                //
                        }
                    })

                    deployment["Account Name"] = deployment["account.name"]
                    delete(deployment["account.name"])
                    deployment["Application Name"] = deployment.name
                    delete(deployment.name)

                    let deploymentDate = new Date(deployment.timestamp).toLocaleDateString()
                    if(deploymentDate == currentDate){
                        metrics.deploysToday = metrics.deploysToday +1
                    }
                    deployment.Date = deploymentDate

                    // delete typenames and add keys to sort options
                    Object.keys(deployment).forEach((deploymentKey)=>{
                        if(deploymentKey.includes("__typename")){
                            delete(deployment[deploymentKey])
                        }else{
                            let dataType = checkType(deployment[deploymentKey])
                            if(!sortByOptions[deploymentKey] && dataType == "string") sortByOptions[deploymentKey] = dataType
                            if(!filterOptions[deploymentKey]) filterOptions[deploymentKey] = dataType
                        }
                    })

                    if(deployment["apmSummary.apdexScore"] < 1 && !metrics.appsWithApdexBelow1.includes(deployment["Application Name"])) metrics.appsWithApdexBelow1.push(deployment["Application Name"])
                    if(deployment["apmSummary.errorRate"] > 0 && !metrics.appsWithErrors.includes(deployment["Application Name"])) metrics.appsWithErrors.push(deployment["Application Name"])
                    if(deployment.alertSeverity != "UNCONFIGURED" && deployment.alertSeverity != "NOT_CONFIGURED" && deployment.alertSeverity != "NOT_ALERTING" && !metrics.appsAlerting.includes(deployment["Application Name"])) metrics.appsAlerting.push(deployment["Application Name"])

                    deployments.push(deployment)
                })
            })

            metrics.total = deployments.length

            // sort keys alphabetically
            sortByOptions = sortObject(sortByOptions)
            filterOptions = sortObject(filterOptions)
            deployments = _.orderBy(deployments, ['timestamp'],['desc']) // sort newest deployments first
            resolve({deployments, sortByOptions, filterOptions, metrics})
        });
    }

    groupDeployments(deployments, groupBy, filters){
        let tempDeployments = [...deployments]
        let filterApdex = false
        let filterError = false

        Object.keys(filters).forEach((filterValue)=>{
            switch(filterValue){
                case "Error Rate > 0":
                    filterError = true
                    break;
                case "Apdex Score < 1":
                    filterApdex = true
                    break;
                case "Alerting":
                    tempDeployments = tempDeployments.filter((deployment)=>deployment.alertSeverity && deployment.alertSeverity != "UNCONFIGURED" && deployment.alertSeverity != "NOT_CONFIGURED" && deployment.alertSeverity != "NOT_ALERTING")
                    break;
                default:
                    let split = filterValue.split(":")
                    if(isNaN(split[1])){
                        tempDeployments = tempDeployments.filter((deployment)=>deployment[split[0]] && deployment[split[0]] == split[1])
                    }else{
                        tempDeployments = tempDeployments.filter((deployment)=>deployment[split[0]] && deployment[split[0]] >= parseFloat(split[1]))
                    }
            }
        })

        // do an OR if filtering apdex and error
        if(filterApdex && filterError){
            tempDeployments = tempDeployments.filter((deployment)=>(deployment["apmSummary.apdexScore"] && deployment["apmSummary.apdexScore"] < 1) || (deployment["apmSummary.errorRate"] && deployment["apmSummary.errorRate"] > 0))
        }else if(filterApdex && !filterError){
            tempDeployments = tempDeployments.filter((deployment)=>deployment["apmSummary.apdexScore"] && deployment["apmSummary.apdexScore"] < 1)
        }else if(filterError && !filterApdex){
            tempDeployments = tempDeployments.filter((deployment)=>deployment["apmSummary.errorRate"] && deployment["apmSummary.errorRate"] > 0)
        }

        let deploymentsGrouped = _.groupBy(tempDeployments, groupBy.value);
        this.setState({deploymentsGrouped})
        this.forceUpdate()
    }



    render() {
        let { groupSelectedMenu, groupSelected, sortByOptions, filters, groupBy, deploymentsGrouped, deploymentsToAnalyze, loading, metrics } = this.state
        return <>
            <Grid>

                <Grid.Row style={{paddingBottom:0}}>
                    <GridColumn width={16} >
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

                <Grid.Row style={{paddingTop:0, borderTop:"1px solid #b9bdbdaf"}}>
                    <Dimmer active={loading}>
                        <Loader size="huge">Please be patient while we collect your deployments...</Loader>
                    </Dimmer>
                    <Grid.Column width={3} className="column-right-border" style={{paddingRight:0, backgroundColor:"#fff", height:this.props.height-120}}>
                        <Menu pointing secondary vertical style={{maxHeight:this.props.height-110, overflowY:"auto", overflowX:"hidden", width:"100%"}}>
                            {
                                Object.keys(deploymentsGrouped).map((group, i)=>{
                                    let name = `${group} (${deploymentsGrouped[group].length})`
                                    return <Menu.Item
                                        key={name + "_" + i}
                                        name={name}
                                        active={groupSelectedMenu === name}
                                        onClick={(e,data)=>this.handleGroupSelect(data.name, group)}
                                    >{name}</Menu.Item> 
                                })
                            }
                        </Menu>
                    </Grid.Column>
                    <Grid.Column width={4} style={{maxHeight:this.props.height-75, padding:"0px"}}>
                        <AutoSizer>
                            {({ height, width }) => {
                                return deploymentsGrouped[groupSelected] ?
                                    <DeploymentFeed
                                        setParentState={this.setParentState}
                                        filters={filters}
                                        height={height}
                                        width={width}
                                        groupSelected={groupSelected}
                                        deployments={deploymentsGrouped[groupSelected]}
                                        deploymentsToAnalyze={deploymentsToAnalyze}
                                    /> : ""
                                }
                            }
                        </AutoSizer>  
                    </Grid.Column>
                    <Grid.Column width={9} style={{padding:"0px", height:"100%"}}>
                        <AutoSizer>
                            {({ height, width }) => {
                                    return <DeploymentsContainer 
                                        height={height}
                                        deploymentsToAnalyze={deploymentsToAnalyze}
                                        deployments={Object.keys(deploymentsToAnalyze).length}
                                        setParentState={this.setParentState}
                                    />
                                }
                            }
                        </AutoSizer>  
                    </Grid.Column>
                </Grid.Row>

            </Grid>
        </>
    }
}