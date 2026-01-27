import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { ScreenHeader } from '@/src/ui/components/ScreenHeader';
import { ui } from '@/src/ui/theme';

export default function PrivacyPolicyScreen() {
  const theme = useColorScheme() ?? 'light';
  const isWeb = Platform.OS === 'web';
  const backgroundColor = theme === 'dark' ? '#000' : '#fff';
  const textColor = theme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScreenHeader title="Privacy Policy" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}>
        <View style={styles.contentWrapper}>
          <Text style={[styles.lastUpdated, { color: secondaryTextColor }]}>
            Last Updated: January 27, 2026
          </Text>

          <Text style={[styles.intro, { color: textColor }]}>
            Frank Taylor & Associates ("we," "our," or "us") operates the FTA mobile application
            (the "App"). This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our App. Please read this Privacy Policy carefully. By
            using the App, you agree to the collection and use of information in accordance with
            this policy.
          </Text>

          <Section title="1. Information We Collect" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="1.1 Personal Information" textColor={textColor} secondaryColor={secondaryTextColor}>
              When you create an account or use our App, we may collect the following personal
              information:
              <BulletList items={[
                'Full name',
                'Email address',
                'Phone number',
                'Home location (city, region)',
                'Profile information you provide during onboarding'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>

            <SubSection title="1.2 Buyer Profile Information" textColor={textColor} secondaryColor={secondaryTextColor}>
              If you use the App as a buyer, we collect:
              <BulletList items={[
                'Industries of interest',
                'Budget range (minimum and maximum)',
                'Timeline for purchase',
                'Search preferences (radius, filters)'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>

            <SubSection title="1.3 Location Information" textColor={textColor} secondaryColor={secondaryTextColor}>
              We collect location data to provide location-based services, including:
              <BulletList items={[
                'Your home location (if provided)',
                'Geographic coordinates (latitude/longitude) for search functionality',
                'Location preferences for practice searches'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
              Location services can be disabled in your device settings, but this may limit
              certain features of the App.
            </SubSection>

            <SubSection title="1.4 Inquiry and Lead Information" textColor={textColor} secondaryColor={secondaryTextColor}>
              When you submit an inquiry about a listing or submit a seller intake form, we
              collect:
              <BulletList items={[
                'Name, email, and phone number',
                'Message content',
                'Preferred callback window',
                'Practice details (for seller submissions)',
                'Industry, location, revenue, and other business information'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>

            <SubSection title="1.5 Usage and Analytics Data" textColor={textColor} secondaryColor={secondaryTextColor}>
              We automatically collect certain information about your use of the App:
              <BulletList items={[
                'Device information (device type, operating system, unique device identifiers)',
                'App usage data and interactions',
                'Favorites and saved listings',
                'Search history and preferences',
                'Notification preferences (push notifications, email notifications)'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            </SubSection>

            <SubSection title="1.6 Third-Party Analytics" textColor={textColor} secondaryColor={secondaryTextColor}>
              We use third-party analytics services, including:
              <BulletList items={[
                'PostHog: For app analytics and user behavior tracking',
                'Sentry: For error tracking and performance monitoring'
              ]} textColor={textColor} secondaryColor={secondaryTextColor} />
              These services may collect anonymized usage data and device identifiers.
            </SubSection>
          </Section>

          <Section title="2. How We Use Your Information" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              We use the information we collect to:
            </Text>
            <BulletList items={[
              'Provide, maintain, and improve the App and its features',
              'Process and facilitate inquiries between buyers and sellers',
              'Send you notifications about new listings matching your preferences',
              'Personalize your experience and show relevant listings',
              'Respond to your inquiries and provide customer support',
              'Send administrative information, updates, and marketing communications (with your consent)',
              'Monitor and analyze usage patterns and trends',
              'Detect, prevent, and address technical issues and security threats',
              'Comply with legal obligations and enforce our Terms and Conditions'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="3. Data Storage and Security" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              Your data is stored securely using industry-standard security measures:
            </Text>
            <BulletList items={[
              'Data is encrypted in transit using HTTPS/TLS',
              'User authentication is handled securely through Supabase',
              'Personal information is stored in secure databases with access controls',
              'We implement Row Level Security (RLS) policies to ensure users can only access their own data',
              'Local device data is stored using secure storage mechanisms'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
            <Text style={[styles.body, { color: textColor, marginTop: ui.spacing.md }]}>
              While we strive to protect your information, no method of transmission over the
              internet or electronic storage is 100% secure. We cannot guarantee absolute security.
            </Text>
          </Section>

          <Section title="4. Data Sharing and Disclosure" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              We do not sell your personal information. We may share your information in the
              following circumstances:
            </Text>
            <BulletList items={[
              'With sellers: When you submit an inquiry about a listing, we share your contact information and message with the seller',
              'With service providers: We share data with third-party service providers (Supabase, PostHog, Sentry) who assist in operating the App',
              'For legal compliance: We may disclose information if required by law, court order, or government regulation',
              'To protect rights: We may share information to protect our rights, property, or safety, or that of our users',
              'Business transfers: In the event of a merger, acquisition, or sale of assets, your information may be transferred'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="5. Your Rights and Choices" textColor={textColor} secondaryColor={secondaryTextColor}>
            <SubSection title="5.1 Access and Correction" textColor={textColor} secondaryColor={secondaryTextColor}>
              You can access and update your personal information at any time through the App's
              profile settings.
            </SubSection>

            <SubSection title="5.2 Data Deletion" textColor={textColor} secondaryColor={secondaryTextColor}>
              You can request deletion of your account and associated data by contacting us at{' '}
              <Text style={[styles.link, { color: textColor }]}>oliver.acton@ft-associates.com</Text>.
              We will process your request in accordance with applicable data protection laws.
            </SubSection>

            <SubSection title="5.3 Notification Preferences" textColor={textColor} secondaryColor={secondaryTextColor}>
              You can manage your notification preferences (push notifications and email
              notifications) in the App settings. You can opt out of marketing communications at any
              time.
            </SubSection>

            <SubSection title="5.4 Location Services" textColor={textColor} secondaryColor={secondaryTextColor}>
              You can disable location services through your device settings, though this may limit
              certain App features.
            </SubSection>

            <SubSection title="5.5 Analytics Opt-Out" textColor={textColor} secondaryColor={secondaryTextColor}>
              While we use analytics to improve the App, you can limit tracking through your device
              privacy settings. Note that some analytics are necessary for App functionality.
            </SubSection>
          </Section>

          <Section title="6. Children's Privacy" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              The App is not intended for individuals under the age of 18. We do not knowingly
              collect personal information from children. If you believe we have collected
              information from a child, please contact us immediately.
            </Text>
          </Section>

          <Section title="7. International Data Transfers" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              Your information may be transferred to and processed in countries other than your
              country of residence. These countries may have data protection laws that differ from
              those in your country. By using the App, you consent to the transfer of your
              information to these countries.
            </Text>
          </Section>

          <Section title="8. Data Retention" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              We retain your personal information for as long as necessary to provide the App and
              fulfill the purposes outlined in this Privacy Policy, unless a longer retention
              period is required or permitted by law. When you delete your account, we will delete
              or anonymize your personal information, except where we are required to retain it for
              legal or regulatory purposes.
            </Text>
          </Section>

          <Section title="9. Changes to This Privacy Policy" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new Privacy Policy in the App and updating the "Last
              Updated" date. Your continued use of the App after such changes constitutes your
              acceptance of the updated Privacy Policy.
            </Text>
          </Section>

          <Section title="10. Apple App Store Requirements" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              In compliance with Apple App Store guidelines:
            </Text>
            <BulletList items={[
              'We do not track users across third-party apps or websites for advertising purposes',
              'We do not share your data with data brokers',
              'We use analytics solely to improve the App experience',
              'Location data is only used to provide location-based features within the App',
              'You can opt out of non-essential data collection through your device settings'
            ]} textColor={textColor} secondaryColor={secondaryTextColor} />
          </Section>

          <Section title="11. Contact Us" textColor={textColor} secondaryColor={secondaryTextColor}>
            <Text style={[styles.body, { color: textColor }]}>
              If you have questions, concerns, or requests regarding this Privacy Policy or our
              data practices, please contact us at:
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
  link: {
    textDecorationLine: 'underline',
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
