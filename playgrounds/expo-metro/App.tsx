import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { getUserQuery, listUsersQuery, updateUserMutation } from "./src/graphql/operations";

export default function App() {
  // Display operation metadata to verify metro plugin is working
  const getUserMeta = getUserQuery.metadata;
  const listUsersMeta = listUsersQuery.metadata;
  const updateUserMeta = updateUserMutation.metadata;

  const hasMetadata = getUserMeta && listUsersMeta && updateUserMeta;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>soda-gql Metro Plugin Verification</Text>
        <Text style={styles.subtitle}>This example demonstrates the metro-plugin integration with Expo.</Text>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Transformation Status:</Text>
          <Text style={[styles.statusValue, hasMetadata ? styles.success : styles.error]}>
            {hasMetadata ? "SUCCESS - Metadata present" : "FAILED - No metadata"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GetUser Query</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.code}>{JSON.stringify(getUserMeta, null, 2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ListUsers Query</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.code}>{JSON.stringify(listUsersMeta, null, 2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UpdateUser Mutation</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.code}>{JSON.stringify(updateUserMeta, null, 2)}</Text>
          </View>
        </View>
      </View>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  statusContainer: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  success: {
    color: "#22c55e",
  },
  error: {
    color: "#ef4444",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  codeBlock: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#333",
  },
});
