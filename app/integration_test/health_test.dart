import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:dear_baby/main.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Health endpoint E2E', () {
    testWidgets('should display OK after tapping Check Health button',
        (tester) async {
      // Use localhost for iOS simulator, 10.0.2.2 for Android emulator.
      // The CI workflow passes --dart-define=BASE_URL to override.
      const baseUrl = String.fromEnvironment(
        'BASE_URL',
        defaultValue: defaultBaseUrl,
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: HealthCheckPage(baseUrl: baseUrl),
        ),
      );

      // Verify initial state
      expect(find.text('Unknown'), findsOneWidget);

      // Tap the health check button
      await tester.tap(find.byKey(const Key('health_button')));

      // Wait for the HTTP request to complete
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // Verify the status changed to OK
      expect(find.text('OK'), findsOneWidget);
    });
  });
}
