
import React from 'react';
import { ChartGroup, LineChart, NrqlQuery, BillboardChart, navigation } from 'nr1'
import { Icon, Label, Header, Divider, Popup, Button } from 'semantic-ui-react';

function openChartBuilder(query, account) {
    const nerdlet = {
      id: 'wanda-data-exploration.nrql-editor',
      urlState: {
        initialActiveInterface: 'nrqlEditor',
        initialChartType:'table',
        initialAccountId: account,
        initialNrqlValue: query,
        isViewingQuery: true,
      }
    }
    navigation.openOverlay(nerdlet)
}

function createMarker(timestamp, color){
    return {
        metadata: {
            id: 'axis-marker-error',
            color: '#000000',
            viz: 'event',
            axisMarkersType: 'alert',
            name: 'Deployment'
        },
        data: [ 
            {
                id: timestamp,
                x0: timestamp,
                x1: timestamp,
            }
        ]
    }
}

export default class DeploymentsContainer extends React.PureComponent {
    constructor(props){
        super(props)
        this.removeDeployment = this.removeDeployment.bind(this);
    }

    removeDeployment(key){
        let { deploymentsToAnalyze, setParentState } = this.props
        delete(deploymentsToAnalyze[key])
        setParentState({deploymentsToAnalyze})
    }

    render(){
        let { deployments, deploymentsToAnalyze } = this.props
        console.log(deploymentsToAnalyze)

        return <div style={{height: this.props.height, overflowY:"auto", overflowX:"hidden", paddingTop:"15px", paddingRight:"25px", paddingLeft:"5px", backgroundColor:"#FFF"}}><ChartGroup>
                    {Object.keys(deploymentsToAnalyze).map((key,i)=>{
                        let deployment = deploymentsToAnalyze[key]
                        let deployDate = new Date(deployment.timestamp).toLocaleString()
                        let appName = deployment["Application Name"]
                        let accName = deployment["Account Name"]
                        let startBeforeMs = 300000 // 5 minutes
                        let sinceTime = deployment.timestamp - startBeforeMs
                        let untilTime = deployment.timestamp + startBeforeMs
                        let appClause = `WHERE appId = ${deployment.applicationId} OR applicationId = ${deployment.applicationId}`
                        let timeClause = `SINCE ${sinceTime} UNTIL ${untilTime}`
                        // let timezone =  `WITH TIMEZONE '${Intl.DateTimeFormat().resolvedOptions().timeZone}'`
                        let throughputQuery = `SELECT count(*) as 'Requests' FROM Transaction, TransactionError`
                        let responseQuery = `SELECT average(duration) as 'Response' FROM Transaction`
                        let chartQuery = `SELECT * FROM Transaction, TransactionError ${appClause} SINCE ${sinceTime} UNTIL ${untilTime} LIMIT MAX`
                        let errorQuery = `SELECT count(*) as 'Errors' FROM Transaction, TransactionError WHERE error IS TRUE OR (httpResponseCode NOT LIKE '2%%' AND httpResponseCode NOT LIKE '3%%') OR error.message IS NOT NULL`
                        let topChartStyle = { width: "125px", height:"50px", display:"inline-block", paddingRight:"15px"}
                        let chartStyle = { width: "300px", height:"150px", display:"inline-block", paddingRight:"15px"}
                        return <div key={i}>
                            <div style={{display:"flex", justifyContent: "space-between"}}>
                                <div>
                                    <BillboardChart
                                        accountId={deployment["account.id"]}
                                        query={`${throughputQuery} ${appClause} ${timeClause}`}
                                        style={topChartStyle}
                                    />
                                    <BillboardChart
                                        accountId={deployment["account.id"]}
                                        query={`${responseQuery} ${appClause} ${timeClause}`}
                                        style={topChartStyle}
                                    />
                                    <BillboardChart
                                        accountId={deployment["account.id"]}
                                        query={`${errorQuery} ${appClause} ${timeClause}`}
                                        style={topChartStyle}
                                    />
                                </div>

                                <div>
                                    <Popup basic content='View Events from 5 minutes before till 5 minutes after your deployment' 
                                        trigger={<Button className="filter-button" icon="chart line" onClick={() => openChartBuilder(chartQuery, deployment["account.id"])} content="View Events" />} 
                                    />
                                </div>

                                <div className="flex-push"></div>

                                <div>
                                    <Header as='h4' style={{textAlign:"right"}}>
                                        <Label image basic onClick={()=>this.removeDeployment(key)} size={"large"} style={{border:"0px", paddingRight:"0px"}}>
                                            {deployDate}<Icon name='delete' />
                                        </Label>
                                        {/* {deployDate} <Icon link name='close' size={"mini"} onClick={()=>this.removeDeployment(key)} /> */}
                                        <Header.Subheader>
                                            <span style={{cursor:"pointer"}} onClick={()=>navigation.openStackedEntity(deployment.guid)}>{appName}</span> on {accName}
                                        </Header.Subheader>
                                        <Header.Subheader>
                                            {deployment.description} : {deployment.revision}
                                        </Header.Subheader>
                                    </Header>
                                </div>
                            </div>
                            
                            <Divider style={{marginTop:"7px", marginBottom:"7px"}} />

                            <div style={{display:"flex", justifyContent: "space-around"}}>
                                    <NrqlQuery accountId={deployment["account.id"]} query={throughputQuery + ` ${appClause} TIMESERIES ${timeClause}`}>
                                        {({data}) => {
                                            if(data){
                                                data = data.map((nrqlData)=>{
                                                    nrqlData.metadata.timezone_offsets = null
                                                    return nrqlData
                                                })
                                                let deploymentMarker = createMarker(deployment.timestamp, "#000000") 
                                                data = data.concat(deploymentMarker)
                                            }
                                            return <LineChart data={data} style={chartStyle}/>;
                                        }}
                                    </NrqlQuery>
                                    <NrqlQuery accountId={deployment["account.id"]} query={responseQuery + ` ${appClause} TIMESERIES ${timeClause}`}>
                                        {({data}) => {
                                            if(data){
                                                data = data.map((nrqlData)=>{
                                                    nrqlData.metadata.timezone_offsets = null
                                                    return nrqlData
                                                })
                                                let deploymentMarker = createMarker(deployment.timestamp, "#000000") 
                                                data = data.concat(deploymentMarker)
                                            }
                                            return <LineChart data={data} style={chartStyle}/>;
                                        }}
                                    </NrqlQuery>
                                    <NrqlQuery accountId={deployment["account.id"]} query={errorQuery + ` ${appClause} TIMESERIES ${timeClause}`}>
                                        {({data}) => {
                                            if(data){
                                                data = data.map((nrqlData)=>{
                                                    nrqlData.metadata.timezone_offsets = null
                                                    return nrqlData
                                                })
                                                let deploymentMarker = createMarker(deployment.timestamp, "#000000") 
                                                data = data.concat(deploymentMarker)
                                            }
                                            return <LineChart data={data} style={chartStyle}/>;
                                        }}
                                    </NrqlQuery>
                            </div>
                            <Divider />
                        </div>
                    })}
        </ChartGroup></div>
    }
}