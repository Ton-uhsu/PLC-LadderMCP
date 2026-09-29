import type { LadderProjectV02 } from "./v02.js";
import { fx3uVerificationFixtures } from "./fx3u-fixtures.js";
import { generateGxWorks2ListText } from "./gxworks2-list.js";

export const fx3uCombinedVerificationProject: LadderProjectV02 = {
  version: "0.2",
  name: "FX3U Combined Verification Suite",
  plc: { family: "Mitsubishi FX", model: "FX3U" },
  programs: [{
    name: "Main",
    networks: [
      ...fx3uVerificationFixtures.nc.programs[0].networks,
      ...fx3uVerificationFixtures.series.programs[0].networks,
      ...fx3uVerificationFixtures.set.programs[0].networks,
      ...fx3uVerificationFixtures.reset.programs[0].networks,
      ...fx3uVerificationFixtures.timer.programs[0].networks,
      ...fx3uVerificationFixtures.counter.programs[0].networks,
      ...fx3uVerificationFixtures.mov.programs[0].networks,
      ...fx3uVerificationFixtures.add.programs[0].networks,
    ].map((n,id)=>({...n,id}))
  }]
};

export function generateCombinedGxWorks2VerificationText(){
  return generateGxWorks2ListText(fx3uCombinedVerificationProject);
}
