import React from "react";
import { AdminPage } from "../features/admin/AdminPage";
import { BreakResearchPage } from "../features/break-research/BreakResearchPage";
import { HomePage } from "../features/home/HomePage";
import { IvResearchPage } from "../features/iv-research/IvResearchPage";
import { GblPage } from "../features/gbl/GblPage";
import { SimResearchPage } from "../features/sim-research/SimResearchPage";
import { SiteLayout } from "./Layout";
import { PokemonSearchHost } from "../features/shared/PokemonSearchHost";

type Route = "/" | "/research/iv" | "/research/break" | "/research/sim" | "/research/gbl" | "/admin";

const titles: Record<Route, string | undefined> = {
  "/": undefined,
  "/research/iv": "個体値研究",
  "/research/break": "ダメージブレイク研究",
  "/research/sim": "バトルシミュレーション研究",
  "/research/gbl": "GBLパーティ振り返り",
  "/admin": "データ管理",
};

function getRouteFromHash(hash: string): Route {
  const normalized = hash.replace(/^#/, "").split("?")[0].replace(/\/+$/, "");
  if (normalized === "/research/gbl" || normalized.startsWith("/research/gbl/")) return "/research/gbl";
  if (
    normalized === "/research/iv" ||
    normalized === "/research/break" ||
    normalized === "/research/sim" ||
    normalized === "/admin"
  ) {
    return normalized;
  }
  return "/";
}

export function App() {
  const [route, setRoute] = React.useState<Route>(() => getRouteFromHash(window.location.hash));

  React.useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <SiteLayout title={titles[route]} route={route}>
      <PokemonSearchHost />
      {route === "/research/iv" ? <IvResearchPage /> : null}
      {route === "/research/break" ? <BreakResearchPage /> : null}
      {route === "/research/sim" ? <SimResearchPage /> : null}
      {route === "/research/gbl" ? <GblPage /> : null}
      {route === "/admin" ? <AdminPage /> : null}
      {route === "/" ? <HomePage /> : null}
    </SiteLayout>
  );
}
