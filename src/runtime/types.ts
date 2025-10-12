/**
 * EMA DevTools Runtime Event Protocol
 * 
 * ブラウザ側フック（ema-devtools-hook.js）とVSCode拡張の間で
 * やり取りされるイベントの型定義
 */

export const PROTOCOL_VERSION = '1.0.0';

/**
 * 基本イベント型
 * すべてのイベントが継承する
 */
export interface BaseRuntimeEvent {
    type: string;
    timestamp: number;
    protocolVersion: string;
}

/**
 * Layer配備イベント（静的）
 * EMA.deploy(layer) が呼ばれたとき
 */
export interface LayerDeployEvent extends BaseRuntimeEvent {
    type: 'layer:deploy';
    data: {
        layerName: string;
        condition: string;
        hasEnter: boolean;
        hasExit: boolean;
    };
}

/**
 * Layer有効化イベント（動的・実行時）
 * Layer.activate() が実行されたとき
 * Signal値の変化により自動的に呼ばれる
 */
export interface LayerActivateEvent extends BaseRuntimeEvent {
    type: 'layer:activate';
    data: {
        layerName: string;
        condition: string;
        signals: Record<string, any>;  // Signal名 → 現在値
    };
}

/**
 * Layer無効化イベント（動的・実行時）
 * Layer.deactivate() が実行されたとき
 * Signal値の変化により自動的に呼ばれる
 */
export interface LayerDeactivateEvent extends BaseRuntimeEvent {
    type: 'layer:deactivate';
    data: {
        layerName: string;
        signals: Record<string, any>;  // Signal名 → 現在値
    };
}

/**
 * Refinement追加イベント（静的）
 * EMA.addPartialMethod(layer, prototype, method, fn) が呼ばれたとき
 */
export interface RefinementAddEvent extends BaseRuntimeEvent {
    type: 'refinement:add';
    data: {
        layerName: string;
        className: string;
        methodName: string;
    };
}

/**
 * すべてのランタイムイベント型
 */
export type RuntimeEvent =
    | LayerDeployEvent
    | LayerActivateEvent
    | LayerDeactivateEvent
    | RefinementAddEvent;

/**
 * イベントハンドラー型
 */
export type RuntimeEventHandler = (event: RuntimeEvent) => void;

/**
 * Layer状態
 */
export type LayerStatus = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';

/**
 * Layer実行時状態
 */
export interface LayerRuntimeState {
    layerName: string;
    status: LayerStatus;
    signals: Record<string, any>;
    lastUpdate: number;
}
