# reports/views.py
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import Report
from .serializers import ReportSerializer, ReportAdminSerializer, ReportStatisticsSerializer
from scanner.models import URL
import logging

logger = logging.getLogger("reports")


class ReportListCreateView(APIView):
    """
    GET  /api/reports/     — List user's own reports
    POST /api/reports/     — Submit a new report
    """
    permission_classes = [IsAuthenticated]

    REASON_SUGGESTIONS = [
        "Brand impersonation and typosquatting",
        "Credential phishing attempt",
        "Malware distribution",
        "Suspicious redirect",
        "Scam or fraud link",
        "Other",
    ]

    REASON_NORMALIZATION_MAP = {
        "brand impersonation": "Brand impersonation and typosquatting",
        "typosquatting": "Brand impersonation and typosquatting",
        "fake paypal": "Brand impersonation and typosquatting",
        "paypal typosquatting": "Brand impersonation and typosquatting",
        "credential phishing": "Credential phishing attempt",
        "phishing": "Credential phishing attempt",
        "login phishing": "Credential phishing attempt",
        "malware": "Malware distribution",
        "redirect": "Suspicious redirect",
        "suspicious redirect": "Suspicious redirect",
        "scam": "Scam or fraud link",
        "fraud": "Scam or fraud link",
        "other": "Other",
    }

    def _parse_reason(self, data):
        """Accept reason with typo fallback and normalize common phishing labels."""
        reason_raw = data.get("reason")
        if not reason_raw:
            reason_raw = data.get("reson")

        if reason_raw is None:
            return None

        reason = str(reason_raw).strip()
        if not reason:
            return ""

        normalized_key = reason.lower()
        return self.REASON_NORMALIZATION_MAP.get(normalized_key, reason)

    def get(self, request):
        """List all reports submitted by the current user"""
        try:
            reports = Report.objects.filter(submitted_by=request.user)
            serializer = ReportSerializer(reports, many=True)
            return Response({
                "count": reports.count(),
                "results": serializer.data
            })
        except Exception as e:
            logger.error(f"Error listing reports: {str(e)}")
            return Response({"error": "Failed to retrieve reports"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Submit a new phishing report"""
        try:
            url_id = request.data.get("url_id")
            reason = self._parse_reason(request.data)
            description = request.data.get("description", "")

            # Validate required fields
            if not url_id:
                return Response({"error": "url_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            if not reason:
                return Response(
                    {
                        "error": "reason is required",
                        "help": "Use request body field 'reason' (not 'reson').",
                        "suggested_reasons": self.REASON_SUGGESTIONS,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if URL exists
            try:
                url = URL.objects.get(id=url_id)
            except URL.DoesNotExist:
                return Response({"error": "URL not found"}, status=status.HTTP_404_NOT_FOUND)

            # Check if user already reported this URL
            existing = Report.objects.filter(
                url=url,
                submitted_by=request.user,
                status__in=["pending", "reviewed"]
            ).exists()
            
            if existing:
                return Response(
                    {"error": "You have already reported this URL"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create report
            report = Report.objects.create(
                url=url,
                submitted_by=request.user,
                reason=reason,
                description=description or None
            )

            logger.info(f"New report created: ID={report.id}, URL={url.id}, User={request.user.id}, Reason={reason}")

            serializer = ReportSerializer(report)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error creating report: {str(e)}")
            return Response({"error": "Failed to create report"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportDetailView(APIView):
    """
    GET  /api/reports/{id}/    — Get report details
    PATCH /api/reports/{id}/   — Update own report (before reviewed)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        """Get a specific report (user can only see their own)"""
        try:
            report = Report.objects.get(id=report_id)
            
            # Check if user is the submitter or an admin
            if report.submitted_by != request.user and not request.user.role == "admin":
                return Response(
                    {"error": "You don't have permission to view this report"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            serializer = ReportSerializer(report)
            return Response(serializer.data)
        except Report.DoesNotExist:
            return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error retrieving report: {str(e)}")
            return Response({"error": "Failed to retrieve report"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, report_id):
        """Update own report (only if still pending)"""
        try:
            report = Report.objects.get(id=report_id)
            
            # Check permissions
            if report.submitted_by != request.user:
                return Response(
                    {"error": "You can only edit your own reports"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if report.status != "pending":
                return Response(
                    {"error": "Can only edit pending reports"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Allow editing description and reason only
            if "description" in request.data:
                report.description = request.data.get("description")
            if "reason" in request.data or "reson" in request.data:
                parsed_reason = self._parse_reason(request.data)
                if not parsed_reason:
                    return Response(
                        {
                            "error": "reason cannot be empty",
                            "suggested_reasons": ReportListCreateView.REASON_SUGGESTIONS,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                report.reason = parsed_reason
            
            report.save()
            logger.info(f"Report updated: ID={report.id}, User={request.user.id}")
            
            serializer = ReportSerializer(report)
            return Response(serializer.data)
        except Report.DoesNotExist:
            return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error updating report: {str(e)}")
            return Response({"error": "Failed to update report"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminReportListView(APIView):
    """
    GET /api/admin/reports/     — List all reports (admin only)
    Used for admin dashboard
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List all reports (admin only)"""
        try:
            # Check admin permission
            if request.user.role != "admin":
                return Response(
                    {"error": "Admin access required"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get filter parameters
            status_filter = request.query_params.get("status")
            reason_filter = request.query_params.get("reason")
            
            reports = Report.objects.all()
            
            if status_filter:
                reports = reports.filter(status=status_filter)
            if reason_filter:
                reports = reports.filter(reason=reason_filter)
            
            serializer = ReportAdminSerializer(reports, many=True)
            return Response({
                "count": reports.count(),
                "results": serializer.data
            })
        except Exception as e:
            logger.error(f"Error listing admin reports: {str(e)}")
            return Response({"error": "Failed to retrieve reports"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminReportDetailView(APIView):
    """
    GET  /api/admin/reports/{id}/   — Get report for review
    PATCH /api/admin/reports/{id}/  — Review and update report status
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        """Get report details for admin review"""
        try:
            if request.user.role != "admin":
                return Response(
                    {"error": "Admin access required"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            report = Report.objects.get(id=report_id)
            serializer = ReportAdminSerializer(report)
            return Response(serializer.data)
        except Report.DoesNotExist:
            return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error retrieving admin report: {str(e)}")
            return Response({"error": "Failed to retrieve report"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, report_id):
        """Review report and update status"""
        try:
            if request.user.role != "admin":
                return Response(
                    {"error": "Admin access required"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            report = Report.objects.get(id=report_id)
            
            # Update status
            new_status = request.data.get("status")
            if new_status and new_status in dict(Report.STATUS_CHOICES):
                report.status = new_status
                report.reviewed_by = request.user
                report.reviewed_at = timezone.now()
            
            # Add admin notes
            if "admin_notes" in request.data:
                report.admin_notes = request.data.get("admin_notes")
            
            report.save()
            logger.info(
                f"Report reviewed: ID={report.id}, Status={report.status}, Admin={request.user.id}"
            )
            
            serializer = ReportAdminSerializer(report)
            return Response(serializer.data)
        except Report.DoesNotExist:
            return Response({"error": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error updating admin report: {str(e)}")
            return Response({"error": "Failed to update report"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportStatisticsView(APIView):
    """
    GET /api/reports/stats/    — Report statistics (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get report statistics"""
        try:
            if request.user.role != "admin":
                return Response(
                    {"error": "Admin access required"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Calculate statistics
            total_reports = Report.objects.count()
            pending_reports = Report.objects.filter(status="pending").count()
            confirmed_count = Report.objects.filter(status="confirmed").count()
            false_positive_count = Report.objects.filter(status="false_positive").count()
            
            # Breakdown by reason
            reasons_breakdown = dict(
                Report.objects.values("reason").annotate(count=Count("id")).values_list("reason", "count")
            )
            
            stats = {
                "total_reports": total_reports,
                "pending_reports": pending_reports,
                "confirmed_count": confirmed_count,
                "false_positive_count": false_positive_count,
                "reasons_breakdown": reasons_breakdown
            }
            
            serializer = ReportStatisticsSerializer(stats)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error calculating statistics: {str(e)}")
            return Response({"error": "Failed to calculate statistics"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
