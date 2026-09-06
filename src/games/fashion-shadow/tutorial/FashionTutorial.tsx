import type React from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

import {
  FASHION_TUTORIAL_CLOSING_LINES,
  FASHION_TUTORIAL_DECISIONS,
  FASHION_TUTORIAL_DOCUMENTS,
  FASHION_TUTORIAL_FINAL_PROMPT,
  FASHION_TUTORIAL_INTRO_LINES,
  FASHION_TUTORIAL_LEARNING_SUMMARY,
  getFashionTutorialDecision,
  getFashionTutorialDocument,
} from './tutorialContent';
import {
  acknowledgeFashionTutorialKnowledge,
  canCompleteFashionTutorial,
  chooseFashionTutorialDocument,
  chooseFashionTutorialFinalDecision,
  createFashionTutorialState,
  startFashionTutorial,
} from './tutorialModel';

interface FashionTutorialProps {
  readonly topInset: number;
  readonly onBack: () => void;
  readonly onComplete: () => void;
}

export const FashionTutorial: React.FC<FashionTutorialProps> = ({
  topInset,
  onBack,
  onComplete,
}) => {
  const [state, setState] = useState(createFashionTutorialState);
  const selectedDocument =
    state.selectedDocumentId === null ? null : getFashionTutorialDocument(state.selectedDocumentId);
  const selectedDecision =
    state.finalDecisionId === null ? null : getFashionTutorialDecision(state.finalDecisionId);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader title="新手关卡 · 永续长的抉择" onBack={onBack} topInset={topInset} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>约 5 分钟 · 单人互动推理</Text>
          <Text style={styles.title}>第一天上班，三份文件</Text>
          <Text style={styles.body}>完成这段训练后，才会解锁正式 7 人房间创建。</Text>
        </View>

        {state.phase === 'intro' ? (
          <View style={styles.card}>
            {FASHION_TUTORIAL_INTRO_LINES.map((line) => (
              <Text key={line} style={styles.body}>
                {line}
              </Text>
            ))}
            <Button
              variant="primary"
              size="lg"
              onPress={() => setState((current) => startFashionTutorial(current))}
            >
              打开牛皮纸信封
            </Button>
          </View>
        ) : null}

        {state.phase === 'documents' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>第一步 · 选择优先调查方向</Text>
              <Text style={styles.body}>三份文件都是真的风险信号，但你只能先查一个环节。</Text>
            </View>
            {FASHION_TUTORIAL_DOCUMENTS.map((document) => (
              <View key={document.id} style={styles.card}>
                <Text style={styles.eyebrow}>
                  选项 {document.option} · {document.esgName}（{document.esg}）
                </Text>
                <Text style={styles.sectionTitle}>{document.title}</Text>
                {document.documentLines.map((line) => (
                  <Text key={line} style={styles.body}>
                    {line}
                  </Text>
                ))}
                <Button
                  variant="secondary"
                  onPress={() =>
                    setState((current) => chooseFashionTutorialDocument(current, document.id))
                  }
                >
                  {document.decisionLabel}
                </Button>
              </View>
            ))}
          </>
        ) : null}

        {state.phase === 'knowledge' && selectedDocument !== null ? (
          <>
            <View style={[styles.card, styles.resultCard]}>
              <Text style={styles.eyebrow}>你的调查结果</Text>
              {selectedDocument.feedbackLines.map((line) => (
                <Text key={line} style={styles.body}>
                  {line}
                </Text>
              ))}
              <Text style={styles.label}>获得线索</Text>
              <Text style={styles.body}>{selectedDocument.clue}</Text>
            </View>
            <View style={[styles.card, styles.knowledgeCard]}>
              <Text style={styles.eyebrow}>强制阅读 · ESG 知识</Text>
              <Text style={styles.sectionTitle}>
                {selectedDocument.esgName}（{selectedDocument.esg}）
              </Text>
              <Text style={styles.body}>{selectedDocument.knowledgeDefinition}</Text>
              <Text style={styles.label}>剧本案例对照</Text>
              <Text style={styles.body}>{selectedDocument.caseStudy}</Text>
              <Button
                variant="primary"
                accessibilityLabel={`我已阅读，并能说出 ${selectedDocument.esg} 的定义`}
                onPress={() => setState((current) => acknowledgeFashionTutorialKnowledge(current))}
              >
                我已阅读，并能说出 {selectedDocument.esg} 的定义
              </Button>
            </View>
          </>
        ) : null}

        {state.phase === 'finalDecision' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>第二步 · 会议室里的决定</Text>
            <Text style={styles.body}>
              会议室里坐着记者、政府官员、消费者代表、工人、品牌方高层、采购总监与供应商。
            </Text>
            <Text style={styles.body}>{FASHION_TUTORIAL_FINAL_PROMPT}</Text>
            {FASHION_TUTORIAL_DECISIONS.map((decision) => (
              <View key={decision.id} style={styles.decisionBlock}>
                <Text style={styles.label}>选项 {decision.option}</Text>
                <Text style={styles.body}>{decision.label}</Text>
                <Text style={styles.hint}>{decision.consequence}</Text>
                <Button
                  variant="secondary"
                  accessibilityLabel={`选择 ${decision.option}`}
                  onPress={() =>
                    setState((current) => chooseFashionTutorialFinalDecision(current, decision.id))
                  }
                >
                  选择 {decision.option}
                </Button>
              </View>
            ))}
          </View>
        ) : null}

        {state.phase === 'ending' && selectedDecision !== null ? (
          <>
            <View style={[styles.card, styles.resultCard]}>
              <Text style={styles.eyebrow}>{selectedDecision.badge}</Text>
              <Text style={styles.sectionTitle}>{selectedDecision.endingTitle}</Text>
              {selectedDecision.endingLines.map((line) => (
                <Text key={line} style={styles.body}>
                  {line}
                </Text>
              ))}
              <Text style={styles.label}>学习总结</Text>
              <Text style={styles.body}>{selectedDecision.lesson}</Text>
              <Text style={styles.label}>剧本案例对照</Text>
              <Text style={styles.body}>{selectedDecision.caseStudy}</Text>
            </View>
            <View style={styles.card}>
              {FASHION_TUTORIAL_CLOSING_LINES.map((line) => (
                <Text key={line} style={styles.body}>
                  {line}
                </Text>
              ))}
              <Text style={styles.sectionTitle}>你已经解锁这些正式游戏知识</Text>
              {FASHION_TUTORIAL_LEARNING_SUMMARY.map((item) => (
                <Text key={item} style={styles.body}>
                  • {item}
                </Text>
              ))}
              <Button
                variant="primary"
                size="lg"
                onPress={onComplete}
                disabled={!canCompleteFashionTutorial(state)}
              >
                完成新手关卡，解锁正式 7 人游戏
              </Button>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  hero: { gap: spacing.small },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    padding: spacing.large,
    gap: spacing.small,
  },
  knowledgeCard: { borderColor: colors.primary },
  resultCard: { borderColor: colors.success },
  decisionBlock: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.medium,
    gap: spacing.small,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  label: {
    color: colors.text,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
});
