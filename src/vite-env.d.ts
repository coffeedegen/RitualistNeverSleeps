/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_RITUAL_MINT_CONTRACT_ADDRESS?: string;
  readonly VITE_RITUAL_MINT_METHOD_NAME?: string;
  readonly VITE_RITUAL_MINT_METHOD_SIGNATURE?: string;
  readonly VITE_RITUAL_MINT_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.jsx" {
  const component: any;
  export default component;
}

declare module "react-dom/client" {
  export interface Root {
    render(children: any): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}
