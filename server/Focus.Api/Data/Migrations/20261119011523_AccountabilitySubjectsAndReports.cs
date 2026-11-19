using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Focus.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AccountabilitySubjectsAndReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CheckSeconds",
                table: "Settings",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SelectedSubjectId",
                table: "Settings",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CheckSeconds",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "CountdownEnd",
                table: "Blocks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Interrupted",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "MakeupTargetMs",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "NextCheckRunningMs",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Blocks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "StudyDayId",
                table: "Blocks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SubjectId",
                table: "Blocks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tags",
                table: "Blocks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "Blocks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "VerifiedThrough",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "BlockInterval",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "Makeup",
                table: "BlockInterval",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "BlockInterval",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "AttentionCheck",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TimerBlockId = table.Column<int>(type: "INTEGER", nullable: false),
                    ScheduledAt = table.Column<long>(type: "INTEGER", nullable: false),
                    Boundary = table.Column<long>(type: "INTEGER", nullable: false),
                    AnsweredAt = table.Column<long>(type: "INTEGER", nullable: true),
                    Answer = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttentionCheck", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttentionCheck_Blocks_TimerBlockId",
                        column: x => x.TimerBlockId,
                        principalTable: "Blocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PersonalIntervals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Start = table.Column<long>(type: "INTEGER", nullable: false),
                    End = table.Column<long>(type: "INTEGER", nullable: false),
                    Label = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonalIntervals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StudyDays",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Start = table.Column<long>(type: "INTEGER", nullable: false),
                    End = table.Column<long>(type: "INTEGER", nullable: true),
                    Zone = table.Column<string>(type: "TEXT", nullable: false),
                    Label = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyDays", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Subjects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Kind = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    NormalizedName = table.Column<string>(type: "TEXT", nullable: false),
                    EstimateMinutes = table.Column<int>(type: "INTEGER", nullable: true),
                    State = table.Column<string>(type: "TEXT", nullable: false),
                    CreationKey = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subjects", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "Settings",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CheckSeconds", "SelectedSubjectId" },
                values: new object[] { 0, 1 });

            migrationBuilder.InsertData(
                table: "Subjects",
                columns: new[] { "Id", "CreationKey", "EstimateMinutes", "Kind", "Name", "NormalizedName", "State" },
                values: new object[] { 1, null, null, "activity", "General Study", "GENERAL STUDY", "active" });

            migrationBuilder.Sql("UPDATE Blocks SET SubjectId = 1, VerifiedThrough = StartedAt WHERE SubjectId IS NULL");
            migrationBuilder.Sql("UPDATE Blocks SET CountdownEnd = EndedAt WHERE Status = 'completed'");

            migrationBuilder.CreateIndex(
                name: "IX_Blocks_StudyDayId",
                table: "Blocks",
                column: "StudyDayId");

            migrationBuilder.CreateIndex(
                name: "IX_Blocks_SubjectId",
                table: "Blocks",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_AttentionCheck_TimerBlockId",
                table: "AttentionCheck",
                column: "TimerBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_CreationKey",
                table: "Subjects",
                column: "CreationKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_NormalizedName",
                table: "Subjects",
                column: "NormalizedName",
                unique: true,
                filter: "Kind = 'activity'");

            migrationBuilder.AddForeignKey(
                name: "FK_Blocks_StudyDays_StudyDayId",
                table: "Blocks",
                column: "StudyDayId",
                principalTable: "StudyDays",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Blocks_Subjects_SubjectId",
                table: "Blocks",
                column: "SubjectId",
                principalTable: "Subjects",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Blocks_StudyDays_StudyDayId",
                table: "Blocks");

            migrationBuilder.DropForeignKey(
                name: "FK_Blocks_Subjects_SubjectId",
                table: "Blocks");

            migrationBuilder.DropTable(
                name: "AttentionCheck");

            migrationBuilder.DropTable(
                name: "PersonalIntervals");

            migrationBuilder.DropTable(
                name: "StudyDays");

            migrationBuilder.DropTable(
                name: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Blocks_StudyDayId",
                table: "Blocks");

            migrationBuilder.DropIndex(
                name: "IX_Blocks_SubjectId",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "CheckSeconds",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "SelectedSubjectId",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "CheckSeconds",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "CountdownEnd",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "Interrupted",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "MakeupTargetMs",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "NextCheckRunningMs",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "StudyDayId",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "SubjectId",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "VerifiedThrough",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "BlockInterval");

            migrationBuilder.DropColumn(
                name: "Makeup",
                table: "BlockInterval");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "BlockInterval");
        }
    }
}
