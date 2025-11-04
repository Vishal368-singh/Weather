// Alternative approach - more permissive type declaration
declare module 'ol-ext/source/IDW' {
  import VectorSource from 'ol/source/Vector';
  import Feature from 'ol/Feature';
  import { Geometry } from 'ol/geom';
  import { Extent } from 'ol/extent';

  export interface IDWOptions {
    source: VectorSource<Feature<Geometry>>;
    weight?: string;
    scale?: number;
    opacity?: number;
    getColor?: (value: number) => number[];
    extent?: Extent;
  }

  // Using 'any' to bypass strict type checking if needed
  const IDW: new (options: IDWOptions) => any;
  export default IDW;
}
