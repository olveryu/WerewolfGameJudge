/** 解码战玩法说明。 */
import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import { TESTIDS } from '@/testids';

/** Displays the approved in-room Decrypto rules. */
export function DecryptoRulesScreen() {
  return <DecryptoRules />;
}

/** Reuses the same guide body inside the room. */
export function DecryptoRules({ embedded = false }: { readonly embedded?: boolean }) {
  return (
    <GameGuide
      title="解码战玩法"
      heading="传递线索，破解对手密码"
      intro="两队各有四个秘密词。出题人用三条线索编码，队友破解自己的密码，同时尝试拦截对手。"
      testId={TESTIDS.gameGuideScreenRoot('decrypto')}
      embedded={embedded}
    >
      <GameGuideSection title="一局怎么玩">
        <RuleItem
          icon="people-outline"
          title="分队与词卡"
          description="4–8 人分成两队；开始后确认队伍和每队出题人。系统给两队各分配四个秘密词。"
        />
        <RuleItem
          icon="play-outline"
          title="编码与破解"
          description="出题人按自己队伍的四个词和三位密码写三条线索。队友提交本队密码；第二轮起，两队还要各自猜对手密码。出题人不参与解码。"
        />
        <RuleItem
          icon="layers-outline"
          title="逐步揭晓"
          description="双方提交后，系统依次揭晓拦截、解码和正确密码。每轮结束由房主继续；随机轮换会在队内轮换出题人，固定模式则整局不变。"
        />
      </GameGuideSection>
      <GameGuideSection title="胜负与加赛">
        <RuleItem
          icon="trophy-outline"
          title="达成胜负条件"
          description="成功拦截两次获胜；本队密码连续错两次则负。最多进行八轮，达到条件时比较“拦截数－误传数”。"
        />
        <RuleItem
          icon="help-circle-outline"
          title="平分加赛"
          description="分差相同则双方提交对手的四个词，由房主逐个判定；正确更多的一队获胜，仍相同则双方共同获胜。"
        />
      </GameGuideSection>
      <GameNotice text="线索应按顺序对应密码中的三个数字。请玩家自行遵守不能直接说出秘密词等桌游规则；应用只检查三条线索均非空。符合真人人数门槛的正常终局才计入奖励和战绩。" />
    </GameGuide>
  );
}
