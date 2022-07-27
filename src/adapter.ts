import {BaseAdapterClient, BaseConfig} from '@basuapi/adapter/dist/src/adapter';
import {BaseAdapter} from '@basuapi/adapter/dist/src/base-adater';
import { ApplicationDeployAdapterClassHolder } from '@basuapi/api/dist/application-deploy-adapter-class-holder';
import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';

class AdapterConfig extends BaseConfig {
  prefix: string
  portsRange: {
    start: number,
    end: number
  }
}

class CustomAdapter extends BaseAdapter<AdapterConfig> {
  ports: number[] = [];
  async init() :Promise<void>{
    //Creating an array with all ports before starting the execution of the program
    let currentPort = this.config.portsRange.start;
    while (currentPort <= this.config.portsRange.end){
      this.ports.push(currentPort);
      currentPort++;
    }

    return await super.init();
  }

  //Customizing the template folder
  protected async getTemplate():Promise<string>{
    const templatePath =  `${process.cwd()}/templates/${this.language.toLowerCase()}/handler.njk`;
    if (!fs.existsSync(templatePath)){
        throw new Error(`${templatePath} does not exists. Make sure you choose a valid language.`);
    }
    return fs.readFileSync(templatePath).toString();
  }


  //Adding custom dependencies
  protected async generateConfigs(dependencies:any){
    dependencies.nunjucks = "^3.2.3"
    return super.generateConfigs(dependencies);
  }

  private async getTemplateForIndex(){
    const templatePath =  `${process.cwd()}/templates/${this.language.toLowerCase()}/index.njk`;
    if (!fs.existsSync(templatePath)){
        throw new Error(`${templatePath} does not exists. `);
    }
    return fs.readFileSync(templatePath).toString();
  }

  /**
   * Setting a new port for each class
   * @param content String containing template
   */
    protected async getRenderedTemplate(content:string, item:ApplicationDeployAdapterClassHolder, routeMethod:string, methods:{routePath:string, method: string, item: ApplicationDeployAdapterClassHolder}[]){
        //Adding prefix to methods
        const methodsWithPrefix = methods.map((m:any) => {
          const newItem = {
            ...m,
            item: { ...m.item}
          } 
          newItem.item.route = this.config.prefix + newItem.item.route;
          return newItem;
        })

        return nunjucks.configure({
            autoescape: false
        }).renderString(content,{item, methods: methodsWithPrefix, routeMethod, port: this.ports.shift()});
    }



   /**
   * Customizing method for files generation.
   * We want to generate a index file containing the logic to start all process.
   */
  protected async generateFiles(classes:ApplicationDeployAdapterClassHolder[]){
    await super.generateFiles(classes);

    const imports:string[] = []
    for (let item of classes){
      const structure = await this.createDestinationStructure(item);
      //Formatting import
      imports.push("./"+structure.replace(path.join(this.destination,'src')+"/",''));
    }


    //Loading current template
    const indexTemplate = await this.getTemplateForIndex();
    const contentFile = nunjucks.configure({
      autoescape: false
    }).renderString(indexTemplate, {imports})

    fs.writeFileSync(`${path.join(this.destination,'src','index.ts')}`,contentFile);

  }

}


export class TemplateAdapter extends BaseAdapterClient<AdapterConfig>{
  constructor(){
    super("template-name","template-description","1.0.0",require('../package.json').name)
  }

  protected async startAdapter(config:AdapterConfig) : Promise<void> {
    config.portsRange = this.getConfig().portsRange;
    if (!config.portsRange || !config.portsRange.start || !config.portsRange.end){
      throw new Error("config.portsRange must be set on .basuapi file");
    }
    config.prefix = this.getConfig().prefix;
    if (!config.prefix){
      config.prefix = '';
    }

    const customAdapter = new CustomAdapter(config);
    await customAdapter.init();
  }


}



new TemplateAdapter().execute();