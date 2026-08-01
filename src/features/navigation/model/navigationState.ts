/** Queries scoped to the navigator that owns the current screen. */

interface NavigationStateReader {
  getState(): { readonly index: number };
}

export function hasPreviousRouteInCurrentNavigator(navigation: NavigationStateReader): boolean {
  return navigation.getState().index > 0;
}
