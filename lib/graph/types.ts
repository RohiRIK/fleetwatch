/**
 * Microsoft Graph API Types
 * Re-exports common types from @microsoft/microsoft-graph-types
 */

export type {
  ManagedDevice,
  User,
  Group,
  Device,
  Organization,
  DirectoryObject,
} from '@microsoft/microsoft-graph-types';

/**
 * Custom response types for Graph API
 */

export interface GraphPagedResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
}

export interface GraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      code: string;
      message: string;
    };
  };
}

/**
 * Query options for Graph API list endpoints
 */
export interface GraphQueryOptions {
  top?: number;
  skip?: number;
  filter?: string;
  select?: string[];
  orderby?: string;
  expand?: string[];
}
