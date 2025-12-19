

declare var process: {
    env: {
        [key: string]: string | undefined;
    };
};

interface ImportMeta {
    readonly env: Record<string, string>;
}

declare namespace React {
    export type FC<P = {}> = (props: P) => any;
    export type ReactNode = any;
    export type SetStateAction<S> = S | ((prevState: S) => S);
    export type Dispatch<A> = (value: A) => void;
}

declare module 'react' {
    export import FC = React.FC;
    export import ReactNode = React.ReactNode;
    export import SetStateAction = React.SetStateAction;
    export import Dispatch = React.Dispatch;

    export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
    export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    export function useRef<T>(initialValue: T): { current: T };
    export function useMemo<T>(factory: () => T, deps: any[] | undefined): T;

    const React: any;
    export default React;
}

declare module 'react/jsx-runtime' {
    export const jsx: any;
    export const jsxs: any;
    export const Fragment: any;
}

declare module 'react-dom/client' {
    export function createRoot(container: Element | DocumentFragment, options?: any): any;
    const ReactDOM: { createRoot: typeof createRoot };
    export default ReactDOM;
}

declare module '@google/genai' {
    export class GoogleGenAI {
        constructor(config: { apiKey: string });
        models: {
            generateContent: (config: any) => Promise<any>;
        };
        live: {
            connect: (config: any) => Promise<any>;
        };
    }
    export enum Modality {
        AUDIO = 'AUDIO'
    }
}
