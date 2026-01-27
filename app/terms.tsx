import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

export default function TermsAndConditionsScreen() {
  const theme = useColorScheme() ?? 'light';
  const isWeb = Platform.OS === 'web';
  const backgroundColor = theme === 'dark' ? '#000' : '#fff';
  const textColor = theme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScreenHeader title="Terms and Conditions" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}>
        <View style={styles.contentWrapper}>
          <Text style={[styles.lastUpdated, { color: secondaryTextColor }]}>
            Last Updated: January 27, 2026
          </Text>

          <Text style={[styles.intro, { color: textColor }]}>
            These Terms and Conditions ("Terms") govern your access to and use of the FTA mobile
            application (the "App") operated by Frank Taylor & Associates ("we," "our," or "us").
            Please read these Terms carefully before using the App. By accessing or using the App,
            you agree to be bound by these Terms. If you do not agree to these Terms, please do not
            use the App.
          </Text>

          <Section title="1. Acceptance of Terms" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              By downloading, installing, accessing, or using the App, you acknowledge that you
              have read, understood, and agree to be bound by these Terms and our Privacy Policy.
              If you do not agree to these Terms, you must not use the App.
            </Text>
          </Section>

          <Section title="2. Description of Service" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              The FTA App is a platform that connects buyers and sellers of dental practices in the
              United Kingdom. The App provides:
            </Text>
            <BulletList items={[
              'A marketplace for browsing dental practice listings',
              'Search and filtering tools to find practices matching your criteria',
              'The ability to save favorite listings',
              'Notification services for new listings matching your preferences',
              'Inquiry submission functionality to contact sellers',
              'Seller intake forms for practice owners to list their practices'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            <Text style={[styles.body, { color: textColor, marginTop: ui.spacing.md }]}>
              We act as an intermediary platform and do not guarantee the accuracy, completeness,
              or quality of listings or the success of any transactions.
            </Text>
          </Section>

          <Section title="3. User Accounts and Registration" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="3.1 Account Creation" textColor={textColor} secondaryColor={secondaryTextColor}>
              To use certain features of the App, you must create an account. You agree to:
              <BulletList items={[
                'Provide accurate, current, and complete information during registration',
                'Maintain and update your account information to keep it accurate',
                'Maintain the security of your account credentials',
                'Accept responsibility for all activities that occur under your account',
                'Notify us immediately of any unauthorized use of your account'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>

            <SubSection title="3.2 Account Eligibility" textColor={textColor} secondaryColor={secondaryTextColor}>
              You must be at least 18 years old to use the App. By using the App, you represent and
              warrant that you are at least 18 years old and have the legal capacity to enter into
              these Terms.
            </SubSection>

            <SubSection title="3.3 Account Termination" textColor={textColor} secondaryColor={secondaryTextColor}>
              We reserve the right to suspend or terminate your account at any time, with or without
              notice, for any reason, including if you violate these Terms or engage in fraudulent,
              abusive, or illegal activity.
            </SubSection>
          </Section>

          <Section title="4. User Conduct" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              You agree not to:
            </Text>
            <BulletList items={[
              'Use the App for any unlawful purpose or in violation of any applicable laws',
              'Impersonate any person or entity or falsely state or misrepresent your affiliation',
              'Interfere with or disrupt the App or servers or networks connected to the App',
              'Attempt to gain unauthorized access to any portion of the App or any other systems',
              'Use automated systems (bots, scrapers) to access the App without our express written permission',
              'Transmit any viruses, malware, or other harmful code',
              'Harass, abuse, or harm other users',
              'Post false, misleading, or fraudulent information',
              'Violate any intellectual property rights of others',
              'Collect or store personal data about other users without their consent'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="5. Listings and Content" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="5.1 Listing Accuracy" textColor={textColor} secondaryColor={secondaryTextColor}>
              While we strive to ensure the accuracy of listings, we do not guarantee that all
              information is complete, accurate, or up-to-date. Listings are provided by sellers,
              and we are not responsible for the accuracy of seller-provided information.
            </SubSection>

            <SubSection title="5.2 Listing Modifications" textColor={textColor} secondaryColor={secondaryTextColor}>
              We reserve the right to modify, remove, or refuse to display any listing at any time
              without notice, including listings that violate these Terms or are deemed
              inappropriate, fraudulent, or misleading.
            </SubSection>

            <SubSection title="5.3 User-Generated Content" textColor={textColor} secondaryColor={secondaryTextColor}>
              You retain ownership of any content you submit through the App (such as inquiries or
              seller intake forms). By submitting content, you grant us a non-exclusive,
              worldwide, royalty-free license to use, reproduce, modify, and display such content
              for the purpose of operating the App.
            </SubSection>
          </Section>

          <Section title="6. Transactions and Inquiries" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="6.1 No Guarantee of Transactions" textColor={textColor} secondaryColor={secondaryTextColor}>
              We facilitate connections between buyers and sellers but do not guarantee that any
              inquiry will result in a transaction. All transactions are solely between buyers and
              sellers. We are not a party to any transaction and are not responsible for the
              terms, conditions, or completion of any transaction.
            </SubSection>

            <SubSection title="6.2 Due Diligence" textColor={textColor} secondaryColor={secondaryTextColor}>
              You are solely responsible for conducting your own due diligence before entering into
              any transaction. We recommend that you:
              <BulletList items={[
                'Verify all information provided in listings',
                'Consult with legal, financial, and professional advisors',
                'Conduct appropriate inspections and investigations',
                'Review all transaction documents carefully'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>

            <SubSection title="6.3 Fees" textColor={textColor} secondaryColor={secondaryTextColor}>
              The App is currently provided free of charge. We reserve the right to introduce fees
              in the future with reasonable notice. Any fees will be clearly disclosed before they
              apply.
            </SubSection>
          </Section>

          <Section title="7. Intellectual Property" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="7.1 App Ownership" textColor={textColor} secondaryColor={secondaryTextColor}>
              The App, including its design, features, functionality, and content (excluding
              user-generated content), is owned by Frank Taylor & Associates and protected by
              copyright, trademark, and other intellectual property laws.
            </SubSection>

            <SubSection title="7.2 Limited License" textColor={textColor} secondaryColor={secondaryTextColor}>
              We grant you a limited, non-exclusive, non-transferable, revocable license to access
              and use the App for your personal, non-commercial use, subject to these Terms.
            </SubSection>

            <SubSection title="7.3 Restrictions" textColor={textColor} secondaryColor={secondaryTextColor}>
              You may not:
              <BulletList items={[
                'Copy, modify, or create derivative works of the App',
                'Reverse engineer, decompile, or disassemble the App',
                'Remove any copyright, trademark, or proprietary notices',
                'Use the App for any commercial purpose without our express written consent'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>
          </Section>

          <Section title="8. Privacy" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              Your use of the App is also governed by our Privacy Policy, which explains how we
              collect, use, and protect your information. By using the App, you consent to the
              collection and use of your information as described in our Privacy Policy.
            </Text>
          </Section>

          <Section title="9. Disclaimers" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL
              WARRANTIES, INCLUDING BUT NOT LIMITED TO:
            </Text>
            <BulletList items={[
              'Warranties of merchantability, fitness for a particular purpose, and non-infringement',
              'Warranties regarding the accuracy, reliability, or availability of the App',
              'Warranties that the App will be uninterrupted, secure, or error-free',
              'Warranties regarding the quality, accuracy, or legality of listings'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="10. Limitation of Liability" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              TO THE FULLEST EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </Text>
            <BulletList items={[
              'Loss of profits, revenue, data, or business opportunities',
              'Damages arising from transactions between buyers and sellers',
              'Damages resulting from reliance on information in listings',
              'Damages resulting from unauthorized access to or use of the App',
              'Damages resulting from any interruption or cessation of the App'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            <Text style={[styles.body, { color: textColor, marginTop: ui.spacing.md }]}>
              Our total liability for any claims arising from your use of the App shall not exceed
              the amount you paid to us (if any) in the twelve months preceding the claim, or £100,
              whichever is greater.
            </Text>
          </Section>

          <Section title="11. Indemnification" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              You agree to indemnify, defend, and hold harmless Frank Taylor & Associates, its
              officers, directors, employees, and agents from and against any claims, liabilities,
              damages, losses, costs, or expenses (including reasonable attorneys' fees) arising
              from:
            </Text>
            <BulletList items={[
              'Your use of the App',
              'Your violation of these Terms',
              'Your violation of any rights of another party',
              'Any content you submit through the App'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="12. Modifications to Terms" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              We reserve the right to modify these Terms at any time. We will notify you of
              material changes by posting the updated Terms in the App and updating the "Last
              Updated" date. Your continued use of the App after such changes constitutes your
              acceptance of the modified Terms. If you do not agree to the modified Terms, you
              must stop using the App.
            </Text>
          </Section>

          <Section title="13. Termination" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="13.1 Termination by You" textColor={textColor} secondaryColor={secondaryTextColor}>
              You may stop using the App at any time by deleting the App from your device and
              requesting deletion of your account.
            </SubSection>

            <SubSection title="13.2 Termination by Us" textColor={textColor} secondaryColor={secondaryTextColor}>
              We may suspend or terminate your access to the App at any time, with or without
              notice, for any reason, including if you violate these Terms.
            </SubSection>

            <SubSection title="13.3 Effect of Termination" textColor={textColor} secondaryColor={secondaryTextColor}>
              Upon termination, your right to use the App will immediately cease. Sections of these
              Terms that by their nature should survive termination will survive, including
              Sections 7 (Intellectual Property), 9 (Disclaimers), 10 (Limitation of Liability),
              and 11 (Indemnification).
            </SubSection>
          </Section>

          <Section title="14. Governing Law and Dispute Resolution" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="14.1 Governing Law" textColor={textColor} secondaryColor={secondaryTextColor}>
              These Terms shall be governed by and construed in accordance with the laws of England
              and Wales, without regard to its conflict of law provisions.
            </SubSection>

            <SubSection title="14.2 Dispute Resolution" textColor={textColor} secondaryColor={secondaryTextColor}>
              Any disputes arising from these Terms or your use of the App shall be subject to the
              exclusive jurisdiction of the courts of England and Wales. You agree to first attempt
              to resolve any dispute through good faith negotiations before initiating legal
              proceedings.
            </SubSection>
          </Section>

          <Section title="15. Apple App Store Terms" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              If you downloaded the App from the Apple App Store:
            </Text>
            <BulletList items={[
              'These Terms are between you and Frank Taylor & Associates, not Apple',
              'Apple is not responsible for the App or its content',
              'Apple has no obligation to provide support or maintenance for the App',
              'If the App fails to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if any)',
              'Apple is not responsible for addressing any claims relating to the App',
              'Apple is a third-party beneficiary of these Terms and has the right to enforce them'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="16. General Provisions" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="16.1 Entire Agreement" textColor={textColor} secondaryColor={secondaryTextColor}>
              These Terms, together with our Privacy Policy, constitute the entire agreement between
              you and us regarding your use of the App.
            </SubSection>

            <SubSection title="16.2 Severability" textColor={textColor} secondaryColor={secondaryTextColor}>
              If any provision of these Terms is found to be unenforceable, the remaining
              provisions will remain in full force and effect.
            </SubSection>

            <SubSection title="16.3 Waiver" textColor={textColor} secondaryColor={secondaryTextColor}>
              Our failure to enforce any provision of these Terms shall not constitute a waiver of
              that provision or any other provision.
            </SubSection>

            <SubSection title="16.4 Assignment" textColor={textColor} secondaryColor={secondaryTextColor}>
              You may not assign or transfer these Terms or your account without our prior written
              consent. We may assign these Terms without restriction.
            </SubSection>
          </Section>

          <Section title="17. Contact Information" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              If you have questions about these Terms, please contact us at:
            </Text>
            <View style={styles.contactBox}>
              <Text style={[styles.contactText, { color: textColor }]}>
                Frank Taylor & Associates{'\n'}
                Email: oliver.acton@ft-associates.com{'\n'}
                Website: https://www.ft-associates.com
              </Text>
            </View>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
  textColor,
  secondaryColor,
}: {
  title: string;
  children: React.ReactNode;
  textColor: string;
  secondaryColor: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      {children}
    </View>
  );
}

function SubSection({
  title,
  children,
  textColor,
  secondaryColor,
}: {
  title: string;
  children: React.ReactNode;
  textColor: string;
  secondaryColor: string;
}) {
  return (
    <View style={styles.subSection}>
      <Text style={[styles.subSectionTitle, { color: textColor }]}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items, textColor, secondaryColor }: { items: string[]; textColor: string; secondaryColor: string }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, idx) => (
        <View key={idx} style={styles.bulletItem}>
          <Text style={[styles.bullet, { color: textColor }]}>•</Text>
          <Text style={[styles.bulletText, { color: textColor }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: ui.spacing.xl * 2,
  },
  contentWrapper: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingTop: ui.spacing.xl,
  },
  lastUpdated: {
    fontSize: 14,
    marginBottom: ui.spacing.lg,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: ui.spacing.xl,
  },
  section: {
    marginBottom: ui.spacing.xl * 1.5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: ui.spacing.md,
    lineHeight: 30,
  },
  subSection: {
    marginTop: ui.spacing.md,
    marginBottom: ui.spacing.sm,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: ui.spacing.sm,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: ui.spacing.md,
  },
  bulletList: {
    marginTop: ui.spacing.sm,
    marginBottom: ui.spacing.md,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: ui.spacing.xs,
    paddingLeft: ui.spacing.xs,
  },
  bullet: {
    fontSize: 16,
    marginRight: ui.spacing.sm,
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  contactBox: {
    marginTop: ui.spacing.md,
    padding: ui.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: ui.radius.md,
  },
  contactText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
