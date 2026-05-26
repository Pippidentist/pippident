import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": {
        "agent-id"?: string;
        "dynamic-variables"?: string;
        children?: React.ReactNode;
      };
    }
  }
}
