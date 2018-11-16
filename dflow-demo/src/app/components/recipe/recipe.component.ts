import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { WorkflowService } from 'src/app/services/workflow.service';
import { WorkflowNode, NodeLabelType } from '../../models/workflow-node';
import { WorkflowLink } from 'src/app/models/workflow-link';
import { WorkflowNodeResolverService } from 'src/app/services/workflow-node-resolver.service';
import { TobService } from '../../services/tob.service';
import { Issuer } from 'src/app/models/issuer';
import { Step } from '../../models/step';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-recipe',
  templateUrl: './recipe.component.html',
  styleUrls: ['./recipe.component.scss']
})
export class RecipeComponent implements OnInit, AfterViewInit {

  @ViewChild('canvasRoot') svgRoot;
  issuers: Array<Issuer>;
  topic: number;
  credentials: any;
  graphLayout: Promise<any>;

  constructor(
    private activatedRoute: ActivatedRoute,
    private workflowService: WorkflowService,
    private nodeResolverService: WorkflowNodeResolverService,
    private tobService: TobService) {
      this.issuers = new Array<Issuer>();
    }

  ngOnInit() {
    // get topicId from route
    this.activatedRoute.queryParams.subscribe((params) => {
      this.topic = params['topic'];
      console.log('Loading topic: ', this.topic);

      // create a promise that will be resolved once the graph is ready to be rendered
      // start with retrieving all the credentials that have been issued so far
      this.graphLayout = this.tobService.getCredentialsByTopic(this.topic).toPromise()
      .then((creds) => {
        this.credentials = creds;
        // get issuer list
        return this.tobService.getIssuers().toPromise();
      }).then((data: any) => {
          data.results.forEach(element => {
            this.issuers.push(new Issuer(element));
          });
      }).then(() => {
        // get topology and set-up graphing library
        return this.tobService.getPathToStep().toPromise();
      }).then((result: any) => {
        // add nodes
        result.nodes.forEach(node => {
          const issuer = this.tobService.getIssuerByDID(node.origin_did, this.issuers);
          const deps = this.tobService.getDependenciesByID(node.id, result.links, this.credentials);
          const credData = this.availableCredForIssuer(issuer);
          const step = new Step(this.topic, node.schema_name, deps, issuer, credData);
          const nodeHTML = this.nodeResolverService.getHTMLForNode(step);
          this.workflowService.addNode(new WorkflowNode(node.id, nodeHTML, NodeLabelType.HTML));
        });

        // add links
        result.links.forEach(link => {
          this.workflowService.addLink(new WorkflowLink(link.target, link.source));
        });
      });
    });
  }

  ngAfterViewInit() {
    // render graph
    this.graphLayout.then(() => {
      this.workflowService.renderGraph(this.svgRoot);
    });
  }

  private availableCredForIssuer (issuer: Issuer) {
    let result;
    this.credentials.forEach(cred => {
      if (cred.credential_type.issuer.did === issuer.did) {
        result = {
          id: cred.id,
          effective_date: cred.effective_date
        };
      }
    });
    return result;
  }

}
