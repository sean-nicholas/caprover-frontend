import { Affix, Button, Card, Checkbox, Col, Icon, Input, message, Modal, Popover, Row, Tabs, Tooltip } from "antd";
import React, { RefObject } from "react";
import { connect } from "react-redux";
import { RouteComponentProps } from "react-router";
import ApiManager from "../../../api/ApiManager";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import Toaster from "../../../utils/Toaster";
import Utils from "../../../utils/Utils";
import ApiComponent from "../../global/ApiComponent";
import CenteredSpinner from "../../global/CenteredSpinner";
import ClickableLink from "../../global/ClickableLink";
import ErrorRetry from "../../global/ErrorRetry";
import { IAppDef } from "../AppDefinition";
import AppConfigs from "./AppConfigs";
import Deployment from "./deploy/Deployment";
import HttpSettings from "./HttpSettings";
const TabPane = Tabs.TabPane;

const WEB_SETTINGS = "WEB_SETTINGS";
const APP_CONFIGS = "APP_CONFIGS";
const DEPLOYMENT = "DEPLOYMENT";

export interface SingleAppApiData {
  appDefinition: IAppDef;
  rootDomain: string;
  defaultNginxConfig: string;
}

export interface AppDetailsTabProps {
  apiData: SingleAppApiData;
  apiManager: ApiManager;
  updateApiData: Function;
  onUpdateConfigAndSave: () => void;
  reFetchData: () => void;
  setLoading: (value: boolean) => void;
  isMobile: boolean;
}

interface PropsInterface extends RouteComponentProps<any> {
  mainContainer: RefObject<HTMLDivElement>;
  isMobile: boolean;
}

class AppDetails extends ApiComponent<
  PropsInterface,
  {
    isLoading: boolean;
    apiData: SingleAppApiData | undefined;
    activeTabKey: string;
    renderCounterForAffixBug: number;
  }
> {
  private reRenderTriggered = false;
  private confirmedAppNameToDelete: string = "";
  private volumesToDelete: IHashMapGeneric<boolean> = {};

  constructor(props: any) {
    super(props);

    this.state = {
      activeTabKey: WEB_SETTINGS,
      isLoading: true,
      renderCounterForAffixBug: 0,
      apiData: undefined
    };
  }

  goBackToApps() {
    this.props.history.push("/apps");
  }

  viewDescription() {
    const self = this;
    const app = self.state.apiData!.appDefinition;
    const tempVal = { tempDescription: app.description };
    Modal.confirm({
      title: "App Description:",
      content: (
        <div>
          <Input.TextArea
            style={{ marginTop: 15 }}
            placeholder="Use app description to take some notes for your app"
            rows={12}
            defaultValue={app.description}
            onChange={e => {
              tempVal.tempDescription = e.target.value;
            }}
          />
        </div>
      ),
      onOk() {
        const changed = app.description !== tempVal.tempDescription;
        app.description = tempVal.tempDescription;
        if (changed) self.onUpdateConfigAndSave();
      }
    });
  }

  onDeleteAppClicked() {
    const self = this;
    const appDef = Utils.copyObject(self.state.apiData!.appDefinition);

    self.confirmedAppNameToDelete = "";

    const allVolumes: string[] = [];

    self.volumesToDelete = {};

    if (appDef.volumes) {
      appDef.volumes.forEach(v => {
        if (v.volumeName) {
          allVolumes.push(v.volumeName);
          self.volumesToDelete[v.volumeName] = true;
        }
      });
    }

    Modal.confirm({
      title: "Confirm Permanent Delete?",
      content: (
        <div>
          <p>
            You are about to delete <code>{appDef.appName}</code>. Enter the
            name of this app in the box below to confirm deletion of this app.
            Please note that this is
            <b> not reversible</b>.
          </p>
          <p className={allVolumes.length ? "" : "hide-on-demand"}>
            Please select the volumes you want to delete. Note that if any of
            the volumes are being used by other CapRover apps, they will not be
            deleted even if you select them. <b>Note: </b>deleting volumes takes
            more than 10 seconds, please be patient
          </p>
          {allVolumes.map(v => {
            return (
              <div key={v}>
                <Checkbox
                  defaultChecked={!!self.volumesToDelete[v]}
                  onChange={(e: any) => {
                    self.volumesToDelete[v] = !self.volumesToDelete[v];
                  }}
                >
                  {v}
                </Checkbox>
              </div>
            );
          })}
          <br />
          <br />

          <p>Confirm App Name:</p>
          <Input
            type="text"
            placeholder={appDef.appName}
            onChange={e => {
              self.confirmedAppNameToDelete = e.target.value.trim();
            }}
          />
        </div>
      ),
      onOk() {
        if (self.confirmedAppNameToDelete !== appDef.appName) {
          message.warning("App name did not match. Operation cancelled.");
          return;
        }

        const volumes: string[] = [];
        Object.keys(self.volumesToDelete).forEach(v => {
          if (self.volumesToDelete[v]) {
            volumes.push(v);
          }
        });

        self.setState({ isLoading: true });
        self.apiManager
          .deleteApp(appDef.appName!, volumes)
          .then(function(data) {
            const volumesFailedToDelete = data.volumesFailedToDelete as string[];
            if (volumesFailedToDelete && volumesFailedToDelete.length) {
              Modal.info({
                title: "Some volumes weren't deleted!",
                content: (
                  <div>
                    <p>
                      Some volumes weren't deleted because they were probably
                      being used by other containers. Sometimes, this is because
                      of a temporary delay when the original container deletion
                      was done with a delay. Please see{" "}
                      <a
                        href="https://caprover.com/docs/app-configuration.html#removing-persistent-apps"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        documentations
                      </a>{" "}
                      and delete them manually if needed. Skipped volumes are:
                    </p>
                    <ul>
                      {volumesFailedToDelete.map(v => (
                        <li>
                          <code>{v}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              });
            }
            message.success("App deleted!");
          })
          .then(function() {
            self.goBackToApps();
          })
          .catch(
            Toaster.createCatcher(function() {
              self.setState({ isLoading: false });
            })
          );
      },
      onCancel() {
        // do nothing
      }
    });
  }

  onUpdateConfigAndSave() {
    const self = this;
    const appDef = Utils.copyObject(self.state.apiData!.appDefinition);
    self.setState({ isLoading: true });
    this.apiManager
      .updateConfigAndSave(appDef.appName!, appDef)
      .then(function() {
        return self.reFetchData();
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    if (!self.reRenderTriggered) {
      //crazy hack to make sure the Affix is showing (delete and save & update)
      self.reRenderTriggered = true;
      setTimeout(function() {
        self.setState({ renderCounterForAffixBug: 1 });
      }, 50);
    }

    if (!self.state.apiData) {
      return <ErrorRetry />;
    }

    const app = self.state.apiData.appDefinition;

    return (
      <Row>
        <Col span={20} offset={2}>
          <Card
            extra={
              <ClickableLink onLinkClicked={() => self.goBackToApps()}>
                <Tooltip title="Close">
                  <Icon type="close" />
                </Tooltip>
              </ClickableLink>
            }
            title={
              <span>
                {app.appName}
                &nbsp;&nbsp;&nbsp;
                <ClickableLink onLinkClicked={() => self.viewDescription()}>
                  <Popover
                    placement="bottom"
                    content={
                      <div style={{ maxWidth: 300, whiteSpace: "pre-line" }}>
                        {app.description || "Click to edit app description..."}
                      </div>
                    }
                    title="App description"
                  >
                    <Icon type="edit" />
                  </Popover>
                </ClickableLink>
              </span>
            }
          >
            <Tabs
              defaultActiveKey={WEB_SETTINGS}
              onChange={key => {
                self.setState({ activeTabKey: key });
              }}
            >
              <TabPane
                tab={<span className="unselectable-span">HTTP Settings</span>}
                key={WEB_SETTINGS}
              >
                <HttpSettings
                  isMobile={this.props.isMobile}
                  setLoading={value => this.setState({ isLoading: value })}
                  reFetchData={() => this.reFetchData()}
                  apiData={this.state.apiData!}
                  apiManager={this.apiManager}
                  updateApiData={(newData: any) =>
                    this.setState({ apiData: newData })
                  }
                  onUpdateConfigAndSave={() => self.onUpdateConfigAndSave()}
                />
              </TabPane>
              <TabPane
                tab={<span className="unselectable-span">App Configs</span>}
                key={APP_CONFIGS}
              >
                <AppConfigs
                  isMobile={this.props.isMobile}
                  setLoading={value => this.setState({ isLoading: value })}
                  reFetchData={() => this.reFetchData()}
                  apiData={this.state.apiData!}
                  apiManager={this.apiManager}
                  updateApiData={(newData: any) =>
                    this.setState({ apiData: newData })
                  }
                  onUpdateConfigAndSave={() => self.onUpdateConfigAndSave()}
                />
              </TabPane>
              <TabPane
                tab={<span className="unselectable-span">Deployment</span>}
                key={DEPLOYMENT}
              >
                <Deployment
                  isMobile={this.props.isMobile}
                  setLoading={value => this.setState({ isLoading: value })}
                  reFetchData={() => this.reFetchData()}
                  apiData={this.state.apiData!}
                  apiManager={this.apiManager}
                  onUpdateConfigAndSave={() => self.onUpdateConfigAndSave()}
                  updateApiData={(newData: any) =>
                    this.setState({ apiData: newData })
                  }
                />
              </TabPane>
            </Tabs>
            <div style={{ height: 70 }} />

            <Affix
              offsetBottom={10}
              target={() => {
                const newLocal = self.props.mainContainer;
                return newLocal && newLocal.current ? newLocal.current : window;
              }}
            >
              <div
                className={
                  self.state.activeTabKey === DEPLOYMENT ? "hide-on-demand" : ""
                }
                style={{
                  borderRadius: 8,
                  background: "rgba(51,73,90,0.9)",
                  paddingTop: 20,
                  paddingBottom: 20
                }}
              >
                <Row type="flex" justify="center" gutter={20}>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Button
                        style={{ minWidth: self.props.isMobile ? 35 : 135 }}
                        type="danger"
                        size="large"
                        onClick={() => self.onDeleteAppClicked()}
                      >
                        {self.props.isMobile ? (
                          <Icon type="delete" />
                        ) : (
                          "Delete App"
                        )}
                      </Button>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Button
                        style={{ minWidth: self.props.isMobile ? 35 : 135 }}
                        type="primary"
                        size="large"
                        onClick={() => self.onUpdateConfigAndSave()}
                      >
                        {self.props.isMobile ? (
                          <Icon type="save" />
                        ) : (
                          "Save & Update"
                        )}
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            </Affix>
          </Card>
        </Col>
      </Row>
    );
  }

  componentDidMount() {
    this.reFetchData();
  }

  reFetchData() {
    const self = this;
    self.setState({ isLoading: true });
    return this.apiManager
      .getAllApps()
      .then(function(data: any) {
        for (let index = 0; index < data.appDefinitions.length; index++) {
          const element = data.appDefinitions[index];
          if (element.appName === self.props.match.params.appName) {
            self.setState({
              isLoading: false,
              apiData: {
                appDefinition: element,
                rootDomain: data.rootDomain,
                defaultNginxConfig: data.defaultNginxConfig
              }
            });
            return;
          }
        }

        // App Not Found!
        self.goBackToApps();
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }
}

function mapStateToProps(state: any) {
  return {
    isMobile: state.globalReducer.isMobile
  };
}

export default connect(
  mapStateToProps,
  undefined
)(AppDetails);
