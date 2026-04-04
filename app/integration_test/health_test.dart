import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:dear_baby/main.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Health endpoint E2E', () {
    testWidgets('should display OK after tapping Check Health button',
        (tester) async {
      await tester.pumpWidget(const DearBabyApp());

      // Verify initial state
      expect(find.text('Unknown'), findsOneWidget);

      // Tap the health check button
      await tester.tap(find.byKey(const Key('health_button')));

      // Poll for the result with a timeout instead of pumpAndSettle
      // (pumpAndSettle can hang if there are ongoing animations)
      var found = false;
      for (var i = 0; i < 50; i++) {
        await tester.pump(const Duration(milliseconds: 200));
        if (find.text('OK').evaluate().isNotEmpty) {
          found = true;
          break;
        }
      }

      // Verify the status changed to OK
      expect(found, isTrue, reason: 'Health status should be OK');
    });
  });
}
