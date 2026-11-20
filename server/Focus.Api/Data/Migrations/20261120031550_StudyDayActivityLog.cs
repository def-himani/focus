using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Focus.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class StudyDayActivityLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Subjects_NormalizedName",
                table: "Subjects");

            migrationBuilder.AddColumn<int>(
                name: "ReversalForBlockId",
                table: "Coins",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "StopwatchOffMs",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "VoidedAt",
                table: "Blocks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_NormalizedName",
                table: "Subjects",
                column: "NormalizedName",
                unique: true,
                filter: "Kind = 'activity' AND State <> 'deleted'");

            migrationBuilder.CreateIndex(
                name: "IX_Coins_ReversalForBlockId",
                table: "Coins",
                column: "ReversalForBlockId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Coins_Blocks_ReversalForBlockId",
                table: "Coins",
                column: "ReversalForBlockId",
                principalTable: "Blocks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Coins_Blocks_ReversalForBlockId",
                table: "Coins");

            migrationBuilder.DropIndex(
                name: "IX_Subjects_NormalizedName",
                table: "Subjects");

            migrationBuilder.DropIndex(
                name: "IX_Coins_ReversalForBlockId",
                table: "Coins");

            migrationBuilder.DropColumn(
                name: "ReversalForBlockId",
                table: "Coins");

            migrationBuilder.DropColumn(
                name: "StopwatchOffMs",
                table: "Blocks");

            migrationBuilder.DropColumn(
                name: "VoidedAt",
                table: "Blocks");

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_NormalizedName",
                table: "Subjects",
                column: "NormalizedName",
                unique: true,
                filter: "Kind = 'activity'");
        }
    }
}
