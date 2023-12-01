export type ReporterData = {
  type: string;
  base: {
    platform: string;
    project: string;
    [key: string]: any;
  };
  data?: Record<string, any>;
};

export type ReporterOptions = { dev: boolean };

export type NodejsMonitorOptions = {
  reporter?: (args: any) => void;
  v8Profile?: boolean;
  heapSnapshot?: boolean;
  STATIC_PATH?: string;
  TIME?: number;
  server?:
    | boolean
    | undefined
    | {
        instance: any;
        baseRouter?: string;
      };
};
