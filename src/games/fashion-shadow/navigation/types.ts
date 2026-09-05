// Fashion Shadow root-route extensions.

export interface FashionConfigRouteParams {
  readonly gameType: 'fashion-shadow';
  readonly mode: 'create';
}

export interface FashionGuideRouteParams {
  readonly gameType: 'fashion-shadow';
  readonly roomCode?: string;
}
