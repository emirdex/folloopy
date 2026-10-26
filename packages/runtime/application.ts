// Production entry bundled ahead of time. The managed host must not launch a
// TypeScript/esbuild service while starting each visitor-facing Node process.
export {productionConfig} from './config';
export {startApi} from '../../apps/api/runtime';
